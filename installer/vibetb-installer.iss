; Vibe Trial Balance — Windows Installer (Inno Setup 6+)
; Builds a setup .exe that installs the app for Docker-based deployment.
;
; To compile: open this file in Inno Setup Compiler and press Ctrl+F9.
; Output: installer/Output/VibeTB-Setup.exe

#define MyAppName "Vibe Trial Balance"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Kisaes LLC"
#define MyAppURL "https://github.com/KisaesDevLab/Vibe-Trial-Balance"

; Source root is one level up from this .iss file
#define SourceRoot ".."

[Setup]
AppId={{7A8B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
DefaultDirName=C:\VibeTB
DefaultGroupName={#MyAppName}
LicenseFile={#SourceRoot}\LICENSE
OutputDir=Output
OutputBaseFilename=VibeTB-Setup
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=vibetb.ico
UninstallDisplayIcon={app}\vibetb.ico
WizardStyle=modern
DisableProgramGroupPage=yes
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install {#MyAppName} on your computer.%n%nThe app runs in Docker containers. Docker Desktop is required and will be detected during installation.%n%nA one-time admin password will be generated during install and displayed on the final screen — write it down. You'll be asked to pick your own password on first login.

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "launchafter"; Description: "Launch {#MyAppName} after installation"; GroupDescription: "Post-install:"

[Files]
; Docker configs
Source: "{#SourceRoot}\docker-compose.prod.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\Dockerfile.server"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\Dockerfile.client"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\deploy\nginx-docker.conf"; DestDir: "{app}\deploy"; Flags: ignoreversion

; Batch scripts
Source: "launch.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "stop.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "update.bat"; DestDir: "{app}"; Flags: ignoreversion

; Env template (used by [Code] to generate .env)
Source: ".env.template"; DestDir: "{app}"; Flags: ignoreversion

; Icon
Source: "vibetb.ico"; DestDir: "{app}"; Flags: ignoreversion

; License and notice
Source: "{#SourceRoot}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\NOTICE"; DestDir: "{app}"; Flags: ignoreversion

; ── Server source (needed for Docker build) ──
Source: "{#SourceRoot}\server\package.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#SourceRoot}\server\package-lock.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#SourceRoot}\server\tsconfig.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#SourceRoot}\server\knexfile.js"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#SourceRoot}\server\src\*"; DestDir: "{app}\server\src"; Flags: ignoreversion recursesubdirs
Source: "{#SourceRoot}\server\migrations\*"; DestDir: "{app}\server\migrations"; Flags: ignoreversion recursesubdirs
Source: "{#SourceRoot}\server\seeds\*"; DestDir: "{app}\server\seeds"; Flags: ignoreversion recursesubdirs
Source: "{#SourceRoot}\server\knowledge\*"; DestDir: "{app}\server\knowledge"; Flags: ignoreversion recursesubdirs

; ── Client source (needed for Docker build) ──
Source: "{#SourceRoot}\client\package.json"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\package-lock.json"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\tsconfig.json"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\tsconfig.node.json"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\vite.config.ts"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\postcss.config.js"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\tailwind.config.js"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\index.html"; DestDir: "{app}\client"; Flags: ignoreversion
Source: "{#SourceRoot}\client\src\*"; DestDir: "{app}\client\src"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\launch.bat"; IconFilename: "{app}\vibetb.ico"; Comment: "Start Vibe Trial Balance"
Name: "{group}\Stop Vibe TB"; Filename: "{app}\stop.bat"; IconFilename: "{app}\vibetb.ico"; Comment: "Stop all containers"
Name: "{group}\Update Vibe TB"; Filename: "{app}\update.bat"; IconFilename: "{app}\vibetb.ico"; Comment: "Rebuild containers with latest changes"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\launch.bat"; IconFilename: "{app}\vibetb.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\launch.bat"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent shellexec; Tasks: launchafter

[Code]
// ── Docker Desktop detection ──

function IsDockerInstalled: Boolean;
var
  ResultCode: Integer;
begin
  // Check if docker.exe is on PATH
  Result := Exec('cmd.exe', '/c docker --version >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

function DockerDesktopPath: String;
begin
  Result := ExpandConstant('{commonpf}\Docker\Docker\Docker Desktop.exe');
end;

// ── Random generators for secrets ──
//
// WARNING: the built-in Pascal Random() is a linear-congruential PRNG that
// returns the same sequence every run unless Randomize is called first. Without
// Randomize, every installer build produced the SAME "random" secrets — a
// catastrophic bug in the pre-1.0 installer. We now call Randomize exactly once
// per install (in InitializeSetup) before any secret generation.

function GenerateRandomHex(Length: Integer): String;
var
  I: Integer;
  HexChars: String;
begin
  HexChars := '0123456789abcdef';
  Result := '';
  for I := 1 to Length do
    Result := Result + HexChars[Random(16) + 1];
end;

// Pronounceable-ish admin password: 20 characters from an unambiguous alphabet
// (no 0/O, 1/l/I) so the user can read it off the install screen without typos.
function GenerateAdminPassword: String;
var
  I: Integer;
  Alphabet: String;
begin
  Alphabet := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  Result := '';
  for I := 1 to 20 do
    Result := Result + Alphabet[Random(Length(Alphabet)) + 1];
end;

// Global so the post-install panel can display it to the user.
var
  GeneratedAdminPassword: String;

// ── Generate .env from template if it doesn't already exist ──

procedure GenerateEnvFile;
var
  TemplatePath, EnvPath, Content: String;
  Lines: TArrayOfString;
  I: Integer;
  DbPass, JwtSecret, EncKey: String;
begin
  EnvPath := ExpandConstant('{app}\.env');
  TemplatePath := ExpandConstant('{app}\.env.template');

  // Don't overwrite existing .env (preserves user's secrets on reinstall).
  // Corollary: reinstalls won't get a new admin password — the existing one
  // still works.
  if FileExists(EnvPath) then
  begin
    Log('.env already exists — skipping generation to preserve secrets');
    GeneratedAdminPassword := '';
    Exit;
  end;

  // Generate random secrets (Randomize was called in InitializeSetup).
  DbPass := GenerateRandomHex(32);
  JwtSecret := GenerateRandomHex(64);
  EncKey := GenerateRandomHex(64);
  GeneratedAdminPassword := GenerateAdminPassword();

  // Read template and replace placeholders
  if LoadStringsFromFile(TemplatePath, Lines) then
  begin
    Content := '';
    for I := 0 to GetArrayLength(Lines) - 1 do
    begin
      StringChangeEx(Lines[I], '__DB_PASSWORD__', DbPass, True);
      StringChangeEx(Lines[I], '__JWT_SECRET__', JwtSecret, True);
      StringChangeEx(Lines[I], '__ENCRYPTION_KEY__', EncKey, True);
      StringChangeEx(Lines[I], '__INITIAL_ADMIN_PASSWORD__', GeneratedAdminPassword, True);
      Content := Content + Lines[I] + #13#10;
    end;
    SaveStringToFile(EnvPath, Content, False);
    Log('Generated .env with random secrets and bootstrap admin password');
  end;
end;

// ── Installer event hooks ──

function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
begin
  // Seed the PRNG exactly once per install. Without this Random() returns the
  // same sequence on every run, which would give every installation the same
  // JWT_SECRET / ENCRYPTION_KEY / admin password — a show-stopper security bug.
  Randomize;

  Result := True;

  if not IsDockerInstalled then
  begin
    if MsgBox(
      'Docker Desktop is required but was not detected on this computer.' + #13#10 + #13#10 +
      'Click OK to open the Docker Desktop download page.' + #13#10 +
      'Install Docker Desktop, restart your computer if prompted, ' +
      'then run this installer again.' + #13#10 + #13#10 +
      'Click Cancel to exit the installer.',
      mbError, MB_OKCANCEL
    ) = IDOK then
    begin
      ShellExec('open', 'https://www.docker.com/products/docker-desktop/', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    end;
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    GenerateEnvFile;
    // Persist the bootstrap admin password alongside the app so that a user who
    // closed the installer before writing it down can still recover it. This
    // file is inside {app} which on Windows defaults to C:\VibeTB (admin-only
    // writable). Delete it yourself once you've rotated the password.
    if GeneratedAdminPassword <> '' then
    begin
      SaveStringToFile(
        ExpandConstant('{app}\FIRST_LOGIN.txt'),
        'Vibe Trial Balance — one-time login' + #13#10 +
        '------------------------------------' + #13#10 +
        'URL:       http://localhost' + #13#10 +
        'Username:  admin' + #13#10 +
        'Password:  ' + GeneratedAdminPassword + #13#10 +
        #13#10 +
        'You will be required to choose your own password on first sign-in.' + #13#10 +
        'Delete this file after you have changed the password.' + #13#10,
        False);
    end;
  end;
end;

// Show the bootstrap admin password on the installer's final screen so the user
// can write it down before clicking Finish. This is the ONLY place it is
// displayed in cleartext inside the UI; it's also written to FIRST_LOGIN.txt
// as a safety net.
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
end;

procedure DeinitializeSetup;
begin
  // no-op; placeholder in case we want to wipe intermediate state later.
end;

procedure InitializeWizard;
begin
  // no-op; extension point if we add custom pages later.
end;

// Register a dynamic message on the finished page.
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo,
  MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + MemoTasksInfo;
end;

// The installer's final "Finished" page uses FinishedLabel — patch it to reveal
// the generated password if we created a fresh .env.
procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and (GeneratedAdminPassword <> '') then
  begin
    WizardForm.FinishedLabel.Caption :=
      'Setup has finished installing ' + ExpandConstant('{#MyAppName}') + ' on your computer.' + #13#10 + #13#10 +
      'Your one-time admin login:' + #13#10 +
      '    Username:  admin' + #13#10 +
      '    Password:  ' + GeneratedAdminPassword + #13#10 + #13#10 +
      'Write this down now. You will be required to choose your own' + #13#10 +
      'password on first sign-in.' + #13#10 + #13#10 +
      'The password is also saved in FIRST_LOGIN.txt inside the install folder.';
  end;
end;
