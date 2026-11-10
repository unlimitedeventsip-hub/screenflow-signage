# Screenflow TV — TCL Android TV 11

TV app code. Player URL is configured at build time, no manual TV keyboard required:

https://screenflowum.netlify.app/play/0e2e173f-b917-4fff-8083-c0705d9590ba

## Get the APK
In GitHub Actions, open "Build Screenflow Android TV APK". When the build succeeds,
download the artifact "screenflow-tv-tcl-android11-apk" and extract app-debug.apk.

## Installation with Windows ADB
The TV from the photo was 192.168.1.134, verify its current IP in TCL settings.
Enabling USB debugging alone does not enable wireless ADB port 5555.

```powershell
$adb = (Get-ChildItem "C:\Users\manil\Downloads\platform-tools-latest-windows" -Filter adb.exe -Recurse | Select-Object -First 1).FullName
& $adb connect 192.168.1.134:5555
& $adb devices
& $adb -s 192.168.1.134:5555 install -r ".\app-debug.apk"
& $adb -s 192.168.1.134:5555 shell am start -n ro.screenflow.tv/.MainActivity
```

To change the linked TV screen without typing on the remote:
```powershell
& $adb -s 192.168.1.134:5555 shell am start -n ro.screenflow.tv/.MainActivity -a android.intent.action.VIEW -d "https://screenflowum.netlify.app/play/NEW-UUID-HERE"
```

Auto-boot is best effort and may be blocked by Android or TCL firmware.
Media is not guaranteed offline. This is a debug-signed testing APK, not
a store release. Site/player must work independently first.
