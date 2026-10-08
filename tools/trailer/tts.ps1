Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
Function Await($t, $type) { $m = $asTaskGeneric.MakeGenericMethod($type); $n = $m.Invoke($null, @($t)); $n.Wait(-1) | Out-Null; $n.Result }
[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
foreach ($line in Get-Content "$dir\lines.txt") {
  $id, $who, $text = $line.Split('|', 3)
  if ($who -eq 'N') { $s.Voice = $voices | ? { $_.DisplayName -like '*Mark*' } | select -First 1; $rate='-12%'; $pitch='-6%' }
  else { $s.Voice = $voices | ? { $_.DisplayName -like '*Zira*' } | select -First 1; $rate='-4%'; $pitch='+2%' }
  $lang = $s.Voice.Language
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$lang'><prosody rate='$rate' pitch='$pitch'>$text</prosody></speak>"
  $stream = Await ($s.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$stream.Size
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [System.IO.File]::WriteAllBytes("$dir\vo\$id.wav", $bytes)
  Write-Output "$id ok"
}
