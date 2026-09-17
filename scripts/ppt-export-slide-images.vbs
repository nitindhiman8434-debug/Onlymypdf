Option Explicit

If WScript.Arguments.Count < 2 Then
  WScript.Echo "Usage: cscript ppt-export-slide-images.vbs <input.ppt|pptx> <outputDir>"
  WScript.Quit 1
End If

Dim inputPath, outputDir, fso, ppt, pres, i, pngPath, slideCount
inputPath = WScript.Arguments(0)
outputDir = WScript.Arguments(1)

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(inputPath) Then
  WScript.Echo "Input file not found"
  WScript.Quit 2
End If

If Not fso.FolderExists(outputDir) Then
  fso.CreateFolder outputDir
End If

inputPath = fso.GetAbsolutePathName(inputPath)
outputDir = fso.GetAbsolutePathName(outputDir)

On Error Resume Next
Set ppt = CreateObject("PowerPoint.Application")
If Err.Number <> 0 Then
  WScript.Echo "PowerPoint not available"
  WScript.Quit 3
End If
ppt.DisplayAlerts = 1
' Uploaded presentations are untrusted: block macro auto-execution.
ppt.AutomationSecurity = 3
Err.Clear

Set pres = ppt.Presentations.Open(inputPath, 0, 0, -1)
slideCount = pres.Slides.Count

For i = 1 To slideCount
  pngPath = fso.BuildPath(outputDir, "slide" & i & ".png")
  If fso.FileExists(pngPath) Then fso.DeleteFile pngPath, True
  pres.Slides(i).Export pngPath, "PNG", 2560, 1440
  If Err.Number <> 0 Then
    WScript.Echo "Export failed slide " & i & ": " & Err.Description
    pres.Close
    ppt.Quit
    WScript.Quit 4
  End If
Next

pres.Close
ppt.Quit

WScript.Echo "OK " & slideCount
