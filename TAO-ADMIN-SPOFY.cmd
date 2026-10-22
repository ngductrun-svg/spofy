@echo off
setlocal
set "SPOFY_ADMIN_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -STA -Command "$lines=[IO.File]::ReadAllLines($env:SPOFY_ADMIN_SELF,[Text.Encoding]::UTF8);$at=[Array]::IndexOf($lines,'#SPOFY_ADMIN_FORM_BEGIN');if($at -lt 0){throw 'Missing SPOFY form'};& ([scriptblock]::Create(($lines[($at+1)..($lines.Length-1)]-join [Environment]::NewLine))) -ValidateOnly:($env:SPOFY_ADMIN_FORM_CHECK -eq '1')"
if errorlevel 1 (
  echo Khong mo duoc bieu mau SPOFY. Hay chup thong bao loi de duoc ho tro.
  pause
)
exit /b
#SPOFY_ADMIN_FORM_BEGIN
param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$script:bootstrap = 'Ly8gVHJ1c3RlZCwgbG9jYWwgZmlyc3QtYWRtaW4gaGVscGVyLiBUaGlzIHNlbGYtY29udGFpbmVkIG1vZHVsZSBpcyBhbHNvIGVtYmVkZGVkCi8vIGluIHRoZSBXaW5kb3dzIGZvcm0gbGF1bmNoZXIuIENyZWRlbnRpYWxzIHRyYXZlbCBvbmx5IHRocm91Z2ggc3RhbmRhcmQgaW5wdXQuCmltcG9ydCB7IHJlYWRGaWxlLCByZWFscGF0aCwgc3RhdCB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnOwppbXBvcnQgeyBpc0Fic29sdXRlLCBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJzsKaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJzsKCmNvbnN0IElOUFVUX0xJTUlUID0gMTYgKiAxMDI0Owpjb25zdCBSRVFVSVJFRF9GSUVMRFMgPSBbJ3Byb2plY3REaXInLCAnbmFtZScsICdlbWFpbCcsICdwYXNzd29yZCcsICdjb25maXJtUGFzc3dvcmQnXTsKY29uc3QgSU5QVVRfRklFTERTID0gbmV3IFNldChbLi4uUkVRVUlSRURfRklFTERTLCAnbW9kZSddKTsKY29uc3QgS05PV05fRVJST1JTID0gT2JqZWN0LmZyZWV6ZSh7CiAgQURNSU5fRVhJU1RTOiAnVGjGsCBt4bulYyBuw6B5IMSRw6MgY8OzIGFkbWluLiBIw6N5IMSRxINuZyBuaOG6rXAgYuG6sW5nIHTDoGkga2hv4bqjbiBhZG1pbiDEkcOjIHThuqFvOyBjw7RuZyBj4bulIGtow7RuZyB0aGF5IMSR4buVaSBob+G6t2MgdOG6oW8gdGjDqm0gYWRtaW4uJywKICBFTUFJTF9FWElTVFM6ICdFbWFpbCBuw6B5IMSRw6MgxJHEg25nIGvDvSBTUE9GWS4gSMOjeSDEkcOhbmggZOG6pXUgbOG7sWEgY2jhu41uIHTDoGkga2hv4bqjbiDEkcOjIGPDsywgcuG7k2kgbmjhuq1wIMSRw7puZyBt4bqtdCBraOG6qXUgU1BPRlkgxJHhu4MgY+G6pXAgcXV54buBbiBhZG1pbiDEkeG6p3UgdGnDqm4uJywKICBWQUxJREFUSU9OOiAnVMOqbiwgZW1haWwgaG/hurdjIG3huq10IGto4bqpdSBjaMawYSBo4bujcCBs4buHLiBWdWkgbMOybmcga2nhu4NtIHRyYSBs4bqhaSB0aMO0bmcgdGluLicsCn0pOwoKY2xhc3MgSGVscGVyRXJyb3IgZXh0ZW5kcyBFcnJvciB7CiAgY29uc3RydWN0b3IoY29kZSwgbWVzc2FnZSkgeyBzdXBlcihtZXNzYWdlKTsgdGhpcy5jb2RlID0gY29kZTsgfQp9CgpmdW5jdGlvbiBpbnZhbGlkKG1lc3NhZ2UpIHsgdGhyb3cgbmV3IEhlbHBlckVycm9yKCdJTlZBTElEX0lOUFVUJywgbWVzc2FnZSk7IH0KCmFzeW5jIGZ1bmN0aW9uIHJlYWRJbnB1dCgpIHsKICBjb25zdCBjaHVua3MgPSBbXTsKICBsZXQgc2l6ZSA9IDA7CiAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBwcm9jZXNzLnN0ZGluKSB7CiAgICBjb25zdCBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykgPyBjaHVuayA6IEJ1ZmZlci5mcm9tKGNodW5rLCAndXRmOCcpOwogICAgc2l6ZSArPSBieXRlcy5sZW5ndGg7CiAgICBpZiAoc2l6ZSA+IElOUFVUX0xJTUlUKSBpbnZhbGlkKCdE4buvIGxp4buHdSBxdcOhIGTDoGkuIFZ1aSBsw7JuZyDEkcOzbmcgY8O0bmcgY+G7pSB2w6AgdGjhu60gbOG6oWkuJyk7CiAgICBjaHVua3MucHVzaChieXRlcyk7CiAgfQogIGxldCB2YWx1ZTsKICB0cnkgeyB2YWx1ZSA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKCd1dGY4JykpOyB9CiAgY2F0Y2ggeyBpbnZhbGlkKCdLaMO0bmcgxJHhu41jIMSRxrDhu6NjIHRow7RuZyB0aW4gdOG7qyBiaeG7g3UgbeG6q3UuIFZ1aSBsw7JuZyBt4bufIGzhuqFpIGPDtG5nIGPhu6UuJyk7IH0KICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkKICAgIHx8IE9iamVjdC5rZXlzKHZhbHVlKS5zb21lKGtleSA9PiAhSU5QVVRfRklFTERTLmhhcyhrZXkpKQogICAgfHwgUkVRVUlSRURfRklFTERTLnNvbWUoa2V5ID0+IHR5cGVvZiB2YWx1ZVtrZXldICE9PSAnc3RyaW5nJykKICAgIHx8ICh2YWx1ZS5tb2RlICE9PSB1bmRlZmluZWQgJiYgIVsnY3JlYXRlJywgJ2V4aXN0aW5nJ10uaW5jbHVkZXModmFsdWUubW9kZSkpKSB7CiAgICBpbnZhbGlkKCdUaMO0bmcgdGluIGJp4buDdSBt4bqrdSBraMO0bmcgaOG7o3AgbOG7hy4gVnVpIGzDsm5nIG3hu58gbOG6oWkgY8O0bmcgY+G7pS4nKTsKICB9CiAgaWYgKCF2YWx1ZS5wcm9qZWN0RGlyIHx8ICFpc0Fic29sdXRlKHZhbHVlLnByb2plY3REaXIpKSBpbnZhbGlkKCdWdWkgbMOybmcgY2jhu41uIHRoxrAgbeG7pWMgU1BPRlkgxJHDoyBnaeG6o2kgbsOpbi4nKTsKICBjb25zdCBtb2RlID0gdmFsdWUubW9kZSA/PyAnY3JlYXRlJzsKICBjb25zdCBuYW1lID0gdmFsdWUubmFtZS5ub3JtYWxpemUoJ05GQycpLnRyaW0oKTsKICBpZiAobW9kZSA9PT0gJ2NyZWF0ZScgJiYgKG5hbWUubGVuZ3RoIDwgMiB8fCBuYW1lLmxlbmd0aCA+IDEwMCB8fCAvW1x1MDAwMC1cdTAwMWZcdTAwN2ZdL3UudGVzdChuYW1lKSkpIGludmFsaWQoJ1TDqm4gYWRtaW4gY+G6p24gdOG7qyAyIMSR4bq/biAxMDAga8O9IHThu7EgaOG7o3AgbOG7hy4nKTsKICBjb25zdCBlbWFpbCA9IHZhbHVlLmVtYWlsLm5vcm1hbGl6ZSgnTkZDJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7CiAgaWYgKGVtYWlsLmxlbmd0aCA8IDMgfHwgZW1haWwubGVuZ3RoID4gMjU0IHx8ICEvXlteXHNAXStAW15cc0BdK1wuW15cc0BdKyQvdS50ZXN0KGVtYWlsKSkgaW52YWxpZCgnVnVpIGzDsm5nIG5o4bqtcCDEkeG7i2EgY2jhu4kgZW1haWwgaOG7o3AgbOG7hy4nKTsKICBpZiAodmFsdWUucGFzc3dvcmQubGVuZ3RoIDwgMTIgfHwgdmFsdWUucGFzc3dvcmQubGVuZ3RoID4gMTI4IHx8IEJ1ZmZlci5ieXRlTGVuZ3RoKHZhbHVlLnBhc3N3b3JkLCAndXRmOCcpID4gNTEyKSB7CiAgICBpbnZhbGlkKCdN4bqtdCBraOG6qXUgY+G6p24gdOG7qyAxMiDEkeG6v24gMTI4IGvDvSB04buxLicpOwogIH0KICBpZiAodmFsdWUucGFzc3dvcmQgIT09IHZhbHVlLmNvbmZpcm1QYXNzd29yZCkgewogICAgdGhyb3cgbmV3IEhlbHBlckVycm9yKCdQQVNTV09SRF9NSVNNQVRDSCcsICdIYWkgbeG6rXQga2jhuql1IGNoxrBhIGdp4buRbmcgbmhhdS4gVnVpIGzDsm5nIG5o4bqtcCBs4bqhaS4nKTsKICB9CiAgcmV0dXJuIHsgLi4udmFsdWUsIG1vZGUsIG5hbWUsIGVtYWlsIH07Cn0KCmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvamVjdChwcm9qZWN0RGlyKSB7CiAgdHJ5IHsKICAgIGNvbnN0IHJvb3QgPSBhd2FpdCByZWFscGF0aChwcm9qZWN0RGlyKTsKICAgIGlmICghKGF3YWl0IHN0YXQocm9vdCkpLmlzRGlyZWN0b3J5KCkpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCcpOwogICAgY29uc3QgcGFja2FnZVBhdGggPSBqb2luKHJvb3QsICdwYWNrYWdlLmpzb24nKTsKICAgIGlmICgoYXdhaXQgc3RhdChwYWNrYWdlUGF0aCkpLnNpemUgPiA2NCAqIDEwMjQpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCcpOwogICAgY29uc3QgbWV0YWRhdGEgPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRGaWxlKHBhY2thZ2VQYXRoLCAndXRmOCcpKTsKICAgIGlmIChtZXRhZGF0YS5uYW1lICE9PSAnc3BvZnktc2NpZW5jZScpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCcpOwogICAgZm9yIChjb25zdCBmaWxlbmFtZSBvZiBbJ2NvbmZpZy5tanMnLCAnZGIubWpzJywgJ2F1dGgubWpzJ10pIHsKICAgICAgaWYgKCEoYXdhaXQgc3RhdChqb2luKHJvb3QsICdzZXJ2ZXInLCBmaWxlbmFtZSkpKS5pc0ZpbGUoKSkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkJyk7CiAgICB9CiAgICByZXR1cm4gcm9vdDsKICB9IGNhdGNoIHsKICAgIHRocm93IG5ldyBIZWxwZXJFcnJvcignUFJPSkVDVF9JTlZBTElEJywgJ0NoxrBhIGNo4buNbiDEkcO6bmcgdGjGsCBt4bulYyBTUE9GWS4gSMOjeSBjaOG7jW4gdGjGsCBt4bulYyDEkcOjIGdp4bqjaSBuw6luIGNo4bupYSBDSEFZLVNQT0ZZLmNtZCB2w6AgdGjGsCBt4bulYyBzZXJ2ZXIuJyk7CiAgfQp9CgpsZXQgZGI7CmxldCB0cmFuc2FjdGlvbk9wZW4gPSBmYWxzZTsKdHJ5IHsKICBjb25zdCBbbWFqb3IsIG1pbm9yXSA9IHByb2Nlc3MudmVyc2lvbnMubm9kZS5zcGxpdCgnLicpLm1hcChOdW1iZXIpOwogIGlmIChtYWpvciA8IDI0IHx8IChtYWpvciA9PT0gMjQgJiYgbWlub3IgPCAxNSkpIHsKICAgIHRocm93IG5ldyBIZWxwZXJFcnJvcignTk9ERV9WRVJTSU9OJywgJ0PhuqduIE5vZGUuanMgMjQuMTUgdHLhu58gbMOqbi4gVnVpIGzDsm5nIGPDoGkgTm9kZS5qcyAyNCBy4buTaSBt4bufIGzhuqFpIGPDtG5nIGPhu6UuJyk7CiAgfQogIGNvbnN0IGlucHV0ID0gYXdhaXQgcmVhZElucHV0KCk7CiAgY29uc3QgcHJvamVjdERpciA9IGF3YWl0IGNoZWNrUHJvamVjdChpbnB1dC5wcm9qZWN0RGlyKTsKICBjb25zdCBsb2FkID0gZmlsZW5hbWUgPT4gaW1wb3J0KHBhdGhUb0ZpbGVVUkwoam9pbihwcm9qZWN0RGlyLCAnc2VydmVyJywgZmlsZW5hbWUpKS5ocmVmKTsKICBsZXQgY29uZmlndXJhdGlvbiwgb3BlbkRhdGFiYXNlLCBwcm92aXNpb25BZG1pbiwgY2hlY2tQYXNzd29yZDsKICB0cnkgewogICAgW3sgY29uZmlndXJhdGlvbiB9LCB7IG9wZW5EYXRhYmFzZSB9LCB7IHByb3Zpc2lvbkFkbWluLCBjaGVja1Bhc3N3b3JkIH1dID0gYXdhaXQgUHJvbWlzZS5hbGwoWwogICAgICBsb2FkKCdjb25maWcubWpzJyksIGxvYWQoJ2RiLm1qcycpLCBsb2FkKCdhdXRoLm1qcycpLAogICAgXSk7CiAgICBpZiAoIVtjb25maWd1cmF0aW9uLCBvcGVuRGF0YWJhc2UsIHByb3Zpc2lvbkFkbWluLCBjaGVja1Bhc3N3b3JkXS5ldmVyeSh2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQnKTsKICB9IGNhdGNoIHsKICAgIHRocm93IG5ldyBIZWxwZXJFcnJvcignUFJPSkVDVF9JTlZBTElEJywgJ0tow7RuZyDEkeG7jWMgxJHGsOG7o2MgbcOjIG5ndeG7k24gU1BPRlkuIEjDo3kgY2jhu41uIMSRw7puZyB0aMawIG3hu6VjIMSRw6MgZ2nhuqNpIG7DqW4gxJHhuqd5IMSR4bunLicpOwogIH0KICBsZXQgY29uZmlnLCBsb2dpblVybDsKICB0cnkgewogICAgY29uZmlnID0gY29uZmlndXJhdGlvbigpOwogICAgaWYgKHR5cGVvZiBjb25maWcuZGJQYXRoICE9PSAnc3RyaW5nJyB8fCAhaXNBYnNvbHV0ZShjb25maWcuZGJQYXRoKSkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkJyk7CiAgICBsb2dpblVybCA9IG5ldyBVUkwoJy9kYW5nLW5oYXA/bmV4dD0lMkZhZG1pbicsIGNvbmZpZy5hcHBPcmlnaW4pLmhyZWY7CiAgfSBjYXRjaCB7CiAgICB0aHJvdyBuZXcgSGVscGVyRXJyb3IoJ0NPTkZJR19JTlZBTElEJywgJ0PhuqV1IGjDrG5oIC5lbnYgY+G7p2EgdGjGsCBt4bulYyBTUE9GWSBjaMawYSBo4bujcCBs4buHLiBWdWkgbMOybmcga2nhu4NtIHRyYSBj4bqldSBow6xuaCB0csaw4bubYyBraGkgdOG6oW8gYWRtaW4uJyk7CiAgfQogIGRiID0gb3BlbkRhdGFiYXNlKGNvbmZpZy5kYlBhdGgpOwogIGxldCB2ZXJpZmllZFJlYWRlcjsKICBpZiAoaW5wdXQubW9kZSA9PT0gJ2V4aXN0aW5nJykgewogICAgaWYgKGRiLnByZXBhcmUoIlNFTEVDVCBpZCBGUk9NIHVzZXJzIFdIRVJFIHJvbGU9J2FkbWluJyBMSU1JVCAxIikuZ2V0KCkpIHRocm93IG5ldyBIZWxwZXJFcnJvcignQURNSU5fRVhJU1RTJywgS05PV05fRVJST1JTLkFETUlOX0VYSVNUUyk7CiAgICB2ZXJpZmllZFJlYWRlciA9IGRiLnByZXBhcmUoJ1NFTEVDVCBpZCxlbWFpbCxwYXNzd29yZF9oYXNoLHJvbGUgRlJPTSB1c2VycyBXSEVSRSBlbWFpbD0/JykuZ2V0KGlucHV0LmVtYWlsKTsKICAgIGNvbnN0IHZhbGlkID0gYXdhaXQgY2hlY2tQYXNzd29yZChpbnB1dC5wYXNzd29yZCwgdmVyaWZpZWRSZWFkZXI/LnBhc3N3b3JkX2hhc2gpOwogICAgaWYgKCF2YWxpZCB8fCB2ZXJpZmllZFJlYWRlcj8ucm9sZSAhPT0gJ3JlYWRlcicpIHsKICAgICAgdGhyb3cgbmV3IEhlbHBlckVycm9yKCdBVVRIX0lOVkFMSUQnLCAnRW1haWwgaG/hurdjIG3huq10IGto4bqpdSB0w6BpIGtob+G6o24gU1BPRlkgY2jGsGEgxJHDum5nLiBLaMO0bmcgY8OzIHTDoGkga2hv4bqjbiBuw6BvIGLhu4sgdGhheSDEkeG7lWkuJyk7CiAgICB9CiAgfQogIC8vIFNlcmlhbGl6ZSB0aGUgdHJ1c3RlZCBoZWxwZXIncyBmaXJzdC1hZG1pbiBjaGVjayBhbmQgd3JpdGUuIEV4aXN0aW5nLXJlYWRlcgogIC8vIHByb21vdGlvbiByZXF1aXJlcyBhbiBleHBsaWNpdCBmb3JtIGNob2ljZSBhbmQgdGhlIGFjY291bnQncyBvd24gcGFzc3dvcmQuCiAgZGIuZXhlYygnQkVHSU4gSU1NRURJQVRFJyk7CiAgdHJhbnNhY3Rpb25PcGVuID0gdHJ1ZTsKICBsZXQgdXNlciwgYWN0aW9uOwogIGlmIChpbnB1dC5tb2RlID09PSAnZXhpc3RpbmcnKSB7CiAgICBpZiAoZGIucHJlcGFyZSgiU0VMRUNUIGlkIEZST00gdXNlcnMgV0hFUkUgcm9sZT0nYWRtaW4nIExJTUlUIDEiKS5nZXQoKSkgdGhyb3cgbmV3IEhlbHBlckVycm9yKCdBRE1JTl9FWElTVFMnLCBLTk9XTl9FUlJPUlMuQURNSU5fRVhJU1RTKTsKICAgIGNvbnN0IGN1cnJlbnQgPSBkYi5wcmVwYXJlKCdTRUxFQ1QgaWQsZW1haWwscGFzc3dvcmRfaGFzaCxyb2xlIEZST00gdXNlcnMgV0hFUkUgaWQ9PycpLmdldCh2ZXJpZmllZFJlYWRlci5pZCk7CiAgICBpZiAoIWN1cnJlbnQgfHwgY3VycmVudC5yb2xlICE9PSAncmVhZGVyJyB8fCBjdXJyZW50LnBhc3N3b3JkX2hhc2ggIT09IHZlcmlmaWVkUmVhZGVyLnBhc3N3b3JkX2hhc2gpIHsKICAgICAgdGhyb3cgbmV3IEhlbHBlckVycm9yKCdBVVRIX0lOVkFMSUQnLCAnVMOgaSBraG/huqNuIMSRw6MgdGhheSDEkeG7lWkuIFZ1aSBsw7JuZyBraeG7g20gdHJhIHRow7RuZyB0aW4gdsOgIHRo4butIGzhuqFpLicpOwogICAgfQogICAgZGIucHJlcGFyZSgiVVBEQVRFIHVzZXJzIFNFVCByb2xlPSdhZG1pbicgV0hFUkUgaWQ9PyBBTkQgcm9sZT0ncmVhZGVyJyIpLnJ1bihjdXJyZW50LmlkKTsKICAgIGRiLnByZXBhcmUoJ0RFTEVURSBGUk9NIHNlc3Npb25zIFdIRVJFIHVzZXJfaWQ9PycpLnJ1bihjdXJyZW50LmlkKTsKICAgIHVzZXIgPSBjdXJyZW50OwogICAgYWN0aW9uID0gJ3Byb21vdGVkJzsKICB9IGVsc2UgewogICAgdXNlciA9IGF3YWl0IHByb3Zpc2lvbkFkbWluKGRiLCBpbnB1dCk7CiAgICBhY3Rpb24gPSAnY3JlYXRlZCc7CiAgfQogIGRiLmV4ZWMoJ0NPTU1JVCcpOwogIHRyYW5zYWN0aW9uT3BlbiA9IGZhbHNlOwogIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGAke0pTT04uc3RyaW5naWZ5KHsgb2s6IHRydWUsIGFjdGlvbiwgZW1haWw6IHVzZXIuZW1haWwsIHByb2plY3REaXIsIGRiUGF0aDogY29uZmlnLmRiUGF0aCwgbG9naW5VcmwgfSl9XG5gKTsKfSBjYXRjaCAoZXJyb3IpIHsKICBpZiAodHJhbnNhY3Rpb25PcGVuKSB7IHRyeSB7IGRiLmV4ZWMoJ1JPTExCQUNLJyk7IH0gY2F0Y2gge30gdHJhbnNhY3Rpb25PcGVuID0gZmFsc2U7IH0KICBjb25zdCBrbm93biA9IHR5cGVvZiBlcnJvcj8uY29kZSA9PT0gJ3N0cmluZycgJiYgT2JqZWN0Lmhhc093bihLTk9XTl9FUlJPUlMsIGVycm9yLmNvZGUpOwogIGNvbnN0IGNvZGUgPSBlcnJvciBpbnN0YW5jZW9mIEhlbHBlckVycm9yIHx8IGtub3duID8gZXJyb3IuY29kZSA6ICdBRE1JTl9DUkVBVEVfRkFJTEVEJzsKICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBIZWxwZXJFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBrbm93biA/IEtOT1dOX0VSUk9SU1tlcnJvci5jb2RlXQogICAgOiAnS2jDtG5nIHRo4buDIHThuqFvIGFkbWluLiBLaeG7g20gdHJhIHF1eeG7gW4gZ2hpIHRoxrAgbeG7pWMgdsOgIGLhuqNvIMSR4bqjbSDEkcOjIGNo4buNbiDEkcO6bmcgYuG6o24gU1BPRlksIHLhu5NpIHRo4butIGzhuqFpLic7CiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoYCR7SlNPTi5zdHJpbmdpZnkoeyBvazogZmFsc2UsIGNvZGUsIG1lc3NhZ2UgfSl9XG5gKTsKICBwcm9jZXNzLmV4aXRDb2RlID0gMTsKfSBmaW5hbGx5IHsKICB0cnkgeyBkYj8uY2xvc2UoKTsgfSBjYXRjaCB7fQp9Cg=='
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
