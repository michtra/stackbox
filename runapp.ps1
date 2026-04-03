$frontend = Start-Process cmd.exe `
            -ArgumentList "/c", "npm run dev" `
            -WorkingDirectory "$PSScriptRoot\frontend" `
            -PassThru
$backend = Start-Process cmd.exe `
            -ArgumentList "/c, venv\scripts\python.exe -m fastapi dev src/main.py" `
            -WorkingDirectory "$PSScriptRoot\backend" `
            -PassThru

try {
    Wait-Process -Id $frontend.Id, $backend.Id
}
finally {
    foreach ($proc in ($frontend, $backend)) {
        if ($proc -and -not $proc.HasExited) {
            taskkill /PID $proc.Id /T /F
        }
    }
}