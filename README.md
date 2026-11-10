# S.B. Public School Chhitauna Admin

Admin-only school management system for **S.B. Public School Chhitauna**, Chhitauna, Nichlaul, Maharajganj, UP. Before login, select the local `database.json` file to use. School records are read from and written back to that selected file; the app does not use Supabase, browser database storage, or a server database.

## Run

1. Open PowerShell in this folder and run `powershell -ExecutionPolicy Bypass -File .\start-local.ps1`.
2. Open `http://127.0.0.1:8000` in Chrome or Edge.
3. Before login, choose **Create new database.json** or **Choose existing database.json**. Allow read/write permission for that file.
4. Sign in with `admin` / `admin123` on the first run, then change the username and password in School settings.

The selected file is the only copy the app updates. Keep it in a secure folder and copy it manually for backups. The browser remembers only the file handle (not school records) and auto-opens the file on later visits when its read/write permission is still granted. Otherwise, choose the file again before login. A JSON starter file is included; its first selection initializes school settings and the Admin account.

## Features

Student admissions and SID filters, teacher records, fee tracking and receipts, exams and marksheets, admit cards, salary statements, school settings, print templates, and notices. Multiple exam scores are grouped into one marksheet per student. Uploaded images/documents are stored in the selected file as Base64, limited to 2 MB each.

## Browser support

Selecting and updating a file requires a recent Chromium browser with the File System Access API, such as Chrome or Edge. Keep the local server running while using the app. The Admin login uses a salted hash, but the selected data file itself is not encrypted; protect it with the laptop's OS account and file permissions.
