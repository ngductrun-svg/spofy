import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(new URL('./admin-form-bootstrap.mjs', import.meta.url), 'utf8');
const powershell = readFileSync(new URL('./windows-admin-form.ps1', import.meta.url), 'utf8').replace(/^\uFEFF/, '').replace('__SPOFY_NODE_BOOTSTRAP__', Buffer.from(source).toString('base64'));
const header = [
  '@echo off',
  'setlocal',
  'set "SPOFY_ADMIN_SELF=%~f0"',
  'powershell.exe -NoLogo -NoProfile -STA -Command "$lines=[IO.File]::ReadAllLines($env:SPOFY_ADMIN_SELF,[Text.Encoding]::UTF8);$at=[Array]::IndexOf($lines,\'#SPOFY_ADMIN_FORM_BEGIN\');if($at -lt 0){throw \'Missing SPOFY form\'};& ([scriptblock]::Create(($lines[($at+1)..($lines.Length-1)]-join [Environment]::NewLine))) -ValidateOnly:($env:SPOFY_ADMIN_FORM_CHECK -eq \'1\')"',
  'if errorlevel 1 (',
  '  echo Khong mo duoc bieu mau SPOFY. Hay chup thong bao loi de duoc ho tro.',
  '  pause',
  ')',
  'exit /b',
  '#SPOFY_ADMIN_FORM_BEGIN',
].join('\r\n');
const output = new URL('../TAO-ADMIN-SPOFY.cmd', import.meta.url);
writeFileSync(output, header + '\r\n' + powershell.replace(/\r?\n/g, '\r\n'));
console.log('Built ' + fileURLToPath(output));
