param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$script:bootstrap = '__SPOFY_NODE_BOOTSTRAP__'
$script:projectDir = ''
$script:busy = $false
$script:loginUrl = ''
$script:peach = [Drawing.ColorTranslator]::FromHtml('#ff9b83')
$script:cream = [Drawing.ColorTranslator]::FromHtml('#f8eee8')
$script:surface = [Drawing.ColorTranslator]::FromHtml('#221a1d')

function Test-SpofyFolder([string]$folder) {
  if (-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)) { return $false }
  foreach ($relative in @('CHAY-SPOFY.cmd','package.json','server\auth.mjs','server\db.mjs','server\config.mjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $folder $relative) -PathType Leaf)) { return $false }
  }
  try { return (([IO.File]::ReadAllText((Join-Path $folder 'package.json')) | ConvertFrom-Json).name -eq 'spofy-science') } catch { return $false }
}
function New-TextLabel([string]$text) {
  $label = New-Object Windows.Forms.Label
  $label.Text = $text; $label.AutoSize = $true; $label.MaximumSize = New-Object Drawing.Size(580,0)
  $label.Margin = New-Object Windows.Forms.Padding(0,10,0,5)
  return $label
}
function New-Entry([bool]$secret = $false) {
  $entry = New-Object Windows.Forms.TextBox
  $entry.Dock = 'Top'; $entry.BackColor = $script:surface; $entry.ForeColor = $script:cream
  $entry.BorderStyle = 'FixedSingle'; $entry.Font = New-Object Drawing.Font('Segoe UI',11)
  $entry.Margin = New-Object Windows.Forms.Padding(0,0,0,3)
  $entry.UseSystemPasswordChar = $secret
  return $entry
}
function Add-Row($control) {
  $row = $body.RowCount; $body.RowCount++
  [void]$body.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::AutoSize)))
  $body.Controls.Add($control,0,$row)
}
function Show-Error([string]$message) {
  [void][Windows.Forms.MessageBox]::Show($form,$message,'SPOFY - Cần kiểm tra',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning)
}

$form = New-Object Windows.Forms.Form
$form.Text = 'SPOFY - Tạo admin đầu tiên'
$form.ClientSize = New-Object Drawing.Size(660,760)
$form.MinimumSize = New-Object Drawing.Size(620,640)
$form.StartPosition = 'CenterScreen'; $form.AutoScaleMode = 'Font'
$form.Font = New-Object Drawing.Font('Segoe UI',10)
$form.BackColor = [Drawing.ColorTranslator]::FromHtml('#0b090a'); $form.ForeColor = $script:cream

$layout = New-Object Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'; $layout.ColumnCount = 1; $layout.RowCount = 3
$layout.Padding = New-Object Windows.Forms.Padding(22)
[void]$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::Percent,100)))
[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::AutoSize)))
[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::Percent,100)))
[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::AutoSize)))
$form.Controls.Add($layout)

$heading = New-TextLabel 'SPOFY / Tạo admin đầu tiên'
$heading.Font = New-Object Drawing.Font('Segoe UI',17,[Drawing.FontStyle]::Bold)
$heading.Margin = New-Object Windows.Forms.Padding(0,0,0,12)
$layout.Controls.Add($heading,0,0)
$scroll = New-Object Windows.Forms.Panel
$scroll.Dock = 'Fill'; $scroll.AutoScroll = $true; $scroll.Margin = New-Object Windows.Forms.Padding(0)
$layout.Controls.Add($scroll,0,1)
$body = New-Object Windows.Forms.TableLayoutPanel
$body.ColumnCount = 1; $body.RowCount = 0; $body.AutoSize = $true; $body.Dock = 'Top'
$body.Padding = New-Object Windows.Forms.Padding(0,0,12,10)
[void]$body.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::Percent,100)))
$scroll.Controls.Add($body)

Add-Row (New-TextLabel 'Giữ nguyên cửa sổ đang chạy website. Điền biểu mẫu này để tạo tài khoản quản trị trên máy của bạn.')
Add-Row (New-TextLabel '1. Thư mục SPOFY đang sử dụng')
$folderRow = New-Object Windows.Forms.TableLayoutPanel
$folderRow.ColumnCount = 2; $folderRow.RowCount = 1; $folderRow.Dock = 'Top'; $folderRow.AutoSize = $true
[void]$folderRow.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::Percent,100)))
[void]$folderRow.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::AutoSize)))
$folderText = New-Entry; $folderText.ReadOnly = $true; $folderText.TabStop = $false
$browse = New-Object Windows.Forms.Button
$browse.Text = 'Chọn CHAY-SPOFY.cmd'; $browse.AutoSize = $true; $browse.Height = 31
$browse.BackColor = $script:surface; $browse.ForeColor = $script:cream; $browse.FlatStyle = 'Flat'
$folderRow.Controls.Add($folderText,0,0); $folderRow.Controls.Add($browse,1,0); Add-Row $folderRow
Add-Row (New-TextLabel 'Chọn đúng file CHAY-SPOFY.cmd bạn đã dùng để mở website. Các bản giải nén khác nhau có dữ liệu riêng.')

$existing = New-Object Windows.Forms.CheckBox
$existing.Text = 'Tôi đã đăng ký SPOFY: cấp quyền admin đầu tiên cho tài khoản đó'
$existing.AutoSize = $true; $existing.MaximumSize = New-Object Drawing.Size(570,0)
$existing.Margin = New-Object Windows.Forms.Padding(0,14,0,5)
Add-Row $existing
$nameLabel = New-TextLabel '2. Tên hiển thị'; Add-Row $nameLabel
$nameInput = New-Entry; $nameInput.Text = 'Admin SPOFY'; $nameInput.MaxLength = 100; Add-Row $nameInput
Add-Row (New-TextLabel 'Email của tài khoản admin')
$emailInput = New-Entry; $emailInput.MaxLength = 254; Add-Row $emailInput
$passwordLabel = New-TextLabel 'Mật khẩu mới cho SPOFY (12-128 ký tự)'; Add-Row $passwordLabel
$passwordInput = New-Entry $true; $passwordInput.MaxLength = 128; Add-Row $passwordInput
$confirmLabel = New-TextLabel 'Nhập lại mật khẩu'; Add-Row $confirmLabel
$confirmInput = New-Entry $true; $confirmInput.MaxLength = 128; Add-Row $confirmInput
$showPassword = New-Object Windows.Forms.CheckBox
$showPassword.Text = 'Hiện mật khẩu'; $showPassword.AutoSize = $true
$showPassword.Margin = New-Object Windows.Forms.Padding(0,8,0,5); Add-Row $showPassword
$helpLabel = New-TextLabel 'Mật khẩu hiện thành các dấu chấm khi bạn gõ. Không cần nhập bất kỳ lệnh CMD nào.'
$helpLabel.ForeColor = $script:peach; Add-Row $helpLabel

$footer = New-Object Windows.Forms.TableLayoutPanel
$footer.Dock = 'Top'; $footer.AutoSize = $true; $footer.ColumnCount = 2; $footer.RowCount = 2
[void]$footer.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::Percent,100)))
[void]$footer.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle([Windows.Forms.SizeType]::AutoSize)))
$status = New-TextLabel 'Chưa thực hiện thay đổi nào.'; $status.ForeColor = $script:peach
$footer.Controls.Add($status,0,0); $footer.SetColumnSpan($status,2)
$create = New-Object Windows.Forms.Button
$create.Text = 'Tạo tài khoản admin'; $create.Height = 44; $create.Dock = 'Top'
$create.BackColor = $script:peach; $create.ForeColor = [Drawing.ColorTranslator]::FromHtml('#251516')
$create.FlatStyle = 'Flat'; $create.Font = New-Object Drawing.Font('Segoe UI',10,[Drawing.FontStyle]::Bold)
$create.Margin = New-Object Windows.Forms.Padding(0,8,8,0)
$close = New-Object Windows.Forms.Button
$close.Text = 'Đóng'; $close.AutoSize = $true; $close.Height = 44
$close.BackColor = $script:surface; $close.ForeColor = $script:cream; $close.FlatStyle = 'Flat'
$close.Margin = New-Object Windows.Forms.Padding(0,8,0,0)
$footer.Controls.Add($create,0,1); $footer.Controls.Add($close,1,1)
$layout.Controls.Add($footer,0,2)
$form.CancelButton = $close

function Select-Project([string]$path) {
  $candidate = [IO.Path]::GetDirectoryName($path)
  if (-not (Test-SpofyFolder $candidate)) { Show-Error 'Thư mục này chưa đúng. Hãy chọn CHAY-SPOFY.cmd trong thư mục đã giải nén đầy đủ mã nguồn SPOFY.'; return }
  $script:projectDir = [IO.Path]::GetFullPath($candidate); $folderText.Text = $script:projectDir
  $status.Text = 'Đã chọn thư mục. Hãy điền email và mật khẩu.'
}
$browse.Add_Click({
  $picker = New-Object Windows.Forms.OpenFileDialog
  $picker.Title = 'Chọn CHAY-SPOFY.cmd đã dùng để mở website'
  $picker.Filter = 'File chạy SPOFY (CHAY-SPOFY.cmd)|CHAY-SPOFY.cmd'; $picker.CheckFileExists = $true
  if ($script:projectDir) { $picker.InitialDirectory = $script:projectDir }
  if ($picker.ShowDialog($form) -eq [Windows.Forms.DialogResult]::OK) { Select-Project $picker.FileName }
  $picker.Dispose()
})
$showPassword.Add_CheckedChanged({
  $passwordInput.UseSystemPasswordChar = -not $showPassword.Checked
  $confirmInput.UseSystemPasswordChar = -not $showPassword.Checked
})
$existing.Add_CheckedChanged({
  $nameInput.Enabled = -not $existing.Checked; $confirmInput.Enabled = -not $existing.Checked
  $passwordInput.Clear(); $confirmInput.Clear()
  if ($existing.Checked) {
    $passwordLabel.Text = 'Mật khẩu SPOFY của tài khoản đã đăng ký'
    $confirmLabel.Text = 'Nhập lại mật khẩu (không cần với tài khoản đã có)'
    $create.Text = 'Cấp quyền admin đầu tiên cho tài khoản này'
    $helpLabel.Text = 'Nhập đúng mật khẩu bạn đã đặt khi đăng ký SPOFY. Công cụ sẽ giữ nguyên tên và mật khẩu, cấp quyền admin đầu tiên và yêu cầu đăng nhập lại.'
  } else {
    $passwordLabel.Text = 'Mật khẩu mới cho SPOFY (12-128 ký tự)'; $confirmLabel.Text = 'Nhập lại mật khẩu'
    $create.Text = 'Tạo tài khoản admin'
    $helpLabel.Text = 'Mật khẩu hiện thành các dấu chấm khi bạn gõ. Không cần nhập bất kỳ lệnh CMD nào.'
  }
})
$close.Add_Click({ if (-not $script:busy) { $form.Close() } })
$form.Add_FormClosing({ param($sender,$event) if ($script:busy) { $event.Cancel = $true } })
$create.Add_Click({
  if ($script:busy) { return }
  if (-not (Test-SpofyFolder $script:projectDir)) { Show-Error 'Trước tiên, bấm Chọn CHAY-SPOFY.cmd và chọn file trong đúng thư mục website đang dùng.'; return }
  $email = $emailInput.Text.Trim(); $name = $nameInput.Text.Trim()
  if ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { Show-Error 'Hãy nhập email đầy đủ, ví dụ tenban@gmail.com.'; $emailInput.Focus(); return }
  if (-not $existing.Checked -and $name.Length -lt 2) { Show-Error 'Tên hiển thị cần ít nhất 2 ký tự.'; $nameInput.Focus(); return }
  if ($passwordInput.Text.Length -lt 12) { Show-Error 'Mật khẩu cần ít nhất 12 ký tự.'; $passwordInput.Focus(); return }
  if (-not $existing.Checked -and $passwordInput.Text -cne $confirmInput.Text) { Show-Error 'Hai mật khẩu chưa giống nhau. Hãy nhập lại.'; $confirmInput.Focus(); return }
  $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $node) { Show-Error 'Chưa tìm thấy Node.js. Hãy cài Node.js 24 LTS, rồi mở lại công cụ này.'; return }
  $script:busy = $true; $scroll.Enabled = $false; $create.Enabled = $false; $close.Enabled = $false
  $status.Text = 'Đang xử lý trên máy của bạn...'; $form.Refresh()
  $process = $null; $payload = $null; $asciiPayload = $null
  try {
    $mode = 'create'; $confirmation = $confirmInput.Text
    if ($existing.Checked) { $mode = 'existing'; $confirmation = $passwordInput.Text }
    $payload = @{projectDir=$script:projectDir;mode=$mode;name=$name;email=$email;password=$passwordInput.Text;confirmPassword=$confirmation} | ConvertTo-Json -Compress
    # ASCII JSON preserves Unicode through Windows PowerShell 5.1's redirected stdin.
    $asciiPayload = [regex]::Replace($payload,'[^\x00-\x7F]',{param($match) '\u' + ([int][char]$match.Value).ToString('x4')})
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $node.Source; $start.WorkingDirectory = $script:projectDir
    $start.Arguments = '--input-type=module --eval "import(''data:text/javascript;base64,{0}'')"' -f $script:bootstrap
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true; $start.WindowStyle = 'Hidden'
    $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
    $start.StandardErrorEncoding = New-Object Text.UTF8Encoding($false)
    $process = New-Object Diagnostics.Process; $process.StartInfo = $start
    [void]$process.Start()
    $outputTask = $process.StandardOutput.ReadToEndAsync(); $errorTask = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.Write($asciiPayload); $process.StandardInput.Close()
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not $process.HasExited) {
      if ([DateTime]::UtcNow -gt $deadline) { $process.Kill(); throw 'FORM_PROCESS_TIMEOUT' }
      [Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 30
    }
    $output = $outputTask.GetAwaiter().GetResult(); [void]$errorTask.GetAwaiter().GetResult()
    try { $result = $output.Trim() | ConvertFrom-Json } catch { throw 'FORM_PROCESS_FAILED' }
    if (-not $result.ok) {
      $status.Text = 'Yêu cầu chưa thành công. Kiểm tra thông báo rồi thử lại.'
      Show-Error ([string]$result.message)
    } else {
      $passwordInput.Clear(); $confirmInput.Clear(); $showPassword.Checked = $false
      $script:loginUrl = $result.loginUrl
      $status.Text = 'Đã hoàn tất. Email: ' + $result.email
      $success = "Đã tạo quyền admin trong thư mục đã chọn.`r`n`r`nEmail: " + $result.email + "`r`n`r`nMở " + $result.loginUrl + " và đăng nhập bằng email, mật khẩu vừa dùng.`r`n`r`nNếu website đang chạy từ một bản giải nén khác, hãy chọn đúng thư mục của bản đó."
      [void][Windows.Forms.MessageBox]::Show($form,$success,'SPOFY - Thành công',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information)
      $create.Text = 'Đã hoàn tất'; $create.Tag = 'done'
    }
  } catch {
    $status.Text = 'Chưa hoàn tất. Không cần đóng cửa sổ website.'
    Show-Error 'Không thể chạy công cụ tạo admin. Kiểm tra Node.js 24.15 trở lên và chọn lại đúng thư mục SPOFY. Bạn có thể chụp thông báo này để được hỗ trợ; không gửi mật khẩu.'
  } finally {
    $payload = $null; $asciiPayload = $null; $confirmation = $null; $output = $null
    if ($process) { $process.Dispose() }
    $script:busy = $false; $scroll.Enabled = $true; $close.Enabled = $true
    $create.Enabled = ($create.Tag -ne 'done')
  }
})

$self = $env:SPOFY_ADMIN_SELF
if ($self) {
  $selfFolder = [IO.Path]::GetDirectoryName($self)
  if (Test-SpofyFolder $selfFolder) { Select-Project (Join-Path $selfFolder 'CHAY-SPOFY.cmd') }
}
if ($ValidateOnly) {
  $initialMask = $passwordInput.UseSystemPasswordChar -and $confirmInput.UseSystemPasswordChar
  $passwordInput.Text = 'temporary'; $showPassword.Checked = $true
  $visibleWorks = -not $passwordInput.UseSystemPasswordChar
  $existing.Checked = $true
  $existingWorks = -not $nameInput.Enabled -and -not $confirmInput.Enabled -and $passwordInput.Text.Length -eq 0
  $existing.Checked = $false
  @{formReady=$true;passwordMasked=$initialMask;showPasswordWorks=$visibleWorks;existingModeWorks=$existingWorks;newModeWorks=$nameInput.Enabled -and $confirmInput.Enabled;projectDetected=[bool]$script:projectDir} | ConvertTo-Json -Compress
  $form.Dispose()
  return
}
[void]$form.ShowDialog()
$passwordInput.Clear(); $confirmInput.Clear(); $form.Dispose()
