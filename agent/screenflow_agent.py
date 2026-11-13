#!/usr/bin/env python3
"""Screenflow LAN Agent v1. Works on Raspberry Pi, mini-PC, or Windows.
Requires Python 3.9+ and Android platform-tools (adb) for TCL control.
The PC must stay on; configure local timezone as Europe/Bucharest.
Creates no inbound ports. Only polls authenticated Supabase RPCs over HTTPS.
Config file screenflow-agent.json (keep its agent_secret PRIVATE).
"""
import datetime
import ipaddress
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
CONFIG = ROOT / "screenflow-agent.json"
CACHE = ROOT / ".screenflow-agent-cache.json"
MAC = re.compile(r"^[a-fA-F0-9]{2}(?:[:-][a-fA-F0-9]{2}){5}$")


def configure():
    if not CONFIG.exists():
        raise SystemExit(
            "Lipseste screenflow-agent.json. Creeaza fisierul din exemplul "
            "screenflow-agent.example.json si copiaza tokenul obtinut din Admin."
        )
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    for field in ("supabase_url", "anon_key", "agent_id", "agent_secret"):
        if not data.get(field):
            raise SystemExit("Lipseste setarea: " + field)
    if not data["supabase_url"].startswith("https://"):
        raise SystemExit("Supabase URL trebuie sa fie HTTPS")
    return data


def rpc(config, function, args):
    url = config["supabase_url"].rstrip("/") + "/rest/v1/rpc/" + function
    body = json.dumps(args).encode("utf-8")
    headers = {
        "apikey": config["anon_key"],
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Screenflow-LAN-Agent/1.0",
    }
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def valid_ipv4(value):
    try:
        address = ipaddress.ip_address(value)
        return str(address) if address.version == 4 and address.is_private else None
    except ValueError:
        return None


def wake(mac):
    if not MAC.fullmatch(mac or ""):
        raise ValueError("Adresa MAC este lipsa sau invalida")
    normalized = re.sub("[:-]", "", mac)
    packet = b"\xff" * 6 + bytes.fromhex(normalized) * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(packet, ("255.255.255.255", 9))
    return "Magic packet transmis (TV trebuie sa suporte Network Standby/Wake-on-LAN)"


def adb_command(config, device, *command):
    ip = valid_ipv4(str(device.get("ip") or ""))
    if not ip:
        raise ValueError("IP privat IPv4 invalid")
    executable = config.get("adb_path") or shutil.which("adb")
    if not executable:
        raise RuntimeError("adb nu este instalat sau adb_path nu este configurat")
    target = ip + ":5555"
    connect = subprocess.run([executable, "connect", target], capture_output=True,
                             text=True, timeout=12)
    if connect.returncode != 0 or "failed" in (connect.stdout + connect.stderr).lower():
        raise RuntimeError("ADB nu raspunde; activeaza depanarea retelei si autorizeaza agentul")
    result = subprocess.run([executable, "-s", target, *command], capture_output=True,
                            text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError("ADB command failed: " + (result.stderr or result.stdout)[:100])
    return result.stdout.strip()[:120] or "Comanda trimisa"


def execute(config, device, action):
    kind = device.get("type")
    if action == "wake":
        return wake(str(device.get("mac") or ""))
    if kind == "android_adb":
        if action in ("launch", "reload"):
            # This only works when Android TV is on and network ADB is paired.
            return adb_command(config, device, "shell", "am", "start",
                               "-n", "ro.screenflow.tv/.MainActivity")
        if action == "standby":
            # KEYCODE_SLEEP is safer than a toggle; still firmware-dependent.
            return adb_command(config, device, "shell", "input", "keyevent", "223")
    if kind == "wol_only":
        raise RuntimeError("Acest TV accepta doar Wake-on-LAN; nu are agent de lansare a aplicatiei")
    if kind == "samsung_remote":
        raise RuntimeError("Samsung necesita asociere Remote API/HDMI-CEC specifica modelului")
    raise RuntimeError("Comanda neimplementata pentru modelul TV")


def local_time():
    return datetime.datetime.now().strftime("%H:%M")


def apply_schedule(config, data, previous):
    if not data.get("schedule_enabled"):
        return previous
    now = local_time()
    date = datetime.date.today().isoformat()
    stamp = date + ":" + now
    if data.get("open_time") == now and previous.get("open") != stamp:
        for dev in data.get("devices", []):
            try:
                wake(str(dev.get("mac") or ""))
                if dev.get("type") == "android_adb":
                    time.sleep(3)
                    execute(config, dev, "launch")
                print("OPEN:", dev.get("name"), "OK")
            except Exception as e:
                print("OPEN:", dev.get("name"), str(e), file=sys.stderr)
        previous["open"] = stamp
    if data.get("close_time") == now and previous.get("close") != stamp:
        for dev in data.get("devices", []):
            try:
                execute(config, dev, "standby")
                print("CLOSE:", dev.get("name"), "OK")
            except Exception as e:
                print("CLOSE:", dev.get("name"), str(e), file=sys.stderr)
        previous["close"] = stamp
    return previous


def main():
    config = configure()
    interval = max(8, min(60, int(config.get("poll_seconds", 12))))
    schedule_state = {}
    last_payload = {}
    last_schedule_tick = None
    if CACHE.exists():
        try:
            last_payload = json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception:
            pass
    print("Screenflow LAN Agent pornit. Control local securizat, fara porturi publice.")
    while True:
        try:
            answer = rpc(config, "poll_tv_control_agent", {
                "p_agent_id": config["agent_id"], "p_secret": config["agent_secret"]
            })
            if not isinstance(answer, dict):
                raise RuntimeError("Raspuns invalid de la Supabase")
            last_payload = {k: answer.get(k) for k in
                            ("schedule_enabled", "open_time", "close_time", "devices")}
            CACHE.write_text(json.dumps(last_payload), encoding="utf-8")
            devices = {str(d.get("screen_id")): d for d in answer.get("devices", [])}
            for cmd in answer.get("commands", []):
                success, result = True, ""
                try:
                    device = devices.get(str(cmd.get("screen_id")))
                    if not device:
                        raise ValueError("TV fara setari de control in aceasta locatie")
                    result = execute(config, device, str(cmd.get("action")))
                except Exception as e:
                    success, result = False, str(e)[:170]
                try:
                    rpc(config, "ack_tv_control_agent", {
                        "p_agent_id": config["agent_id"], "p_secret": config["agent_secret"],
                        "p_command_id": cmd["id"], "p_ok": success, "p_result": result
                    })
                except Exception as e:
                    print("Nu pot confirma comanda:", str(e), file=sys.stderr)
        except Exception as e:
            print("Server indisponibil; folosesc programul salvat:", str(e)[:120],
                  file=sys.stderr)
        tick = local_time()
        if tick != last_schedule_tick and last_payload:
            schedule_state = apply_schedule(config, last_payload, schedule_state)
            last_schedule_tick = tick
        time.sleep(interval)


if __name__ == "__main__":
    main()
