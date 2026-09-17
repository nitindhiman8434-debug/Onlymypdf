Option Explicit

If WScript.Arguments.Count < 2 Then
  WScript.Echo "Usage: cscript ppt-save-as-pptx.vbs <input.ppt> <output.pptx>"
  WScript.Quit 1
End If

Dim inputPath, outputPath, fso, ppt, pres
inputPath = WScript.Arguments(0)
outputPath = WScript.Arguments(1)

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(inputPath) Then
  WScript.Echo "Input file not found"
  WScript.Quit 2
End If

inputPath = fso.GetAbsolutePathName(inputPath)
outputPath = fso.GetAbsolutePathName(outputPath)

If fso.FileExists(outputPath) Then
  fso.DeleteFile outputPath, True
End If

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

Const ppSaveAsOpenXMLPresentation = 24
pres.SaveAs outputPath, ppSaveAsOpenXMLPresentation
If Err.Number <> 0 Then
  WScript.Echo "Save failed: " & Err.Description
  pres.Close
  ppt.Quit
  WScript.Quit 4
End If

pres.Close
ppt.Quit

If Not fso.FileExists(outputPath) Then
  WScript.Echo "Output not created"
  WScript.Quit 5
End If

WScript.Echo "OK"
