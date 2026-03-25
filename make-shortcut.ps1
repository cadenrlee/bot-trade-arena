$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("C:\Users\caden\Desktop\Bot Trade Arena.lnk")
$shortcut.TargetPath = "C:\Users\caden\Downloads\bot-trade-arena\start.bat"
$shortcut.WorkingDirectory = "C:\Users\caden\Downloads\bot-trade-arena"
$shortcut.Description = "Launch Bot Trade Arena"
$shortcut.IconLocation = "C:\Windows\System32\shell32.dll,21"
$shortcut.Save()
Write-Host "Shortcut created on Desktop"
