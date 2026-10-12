import subprocess
import os

html = """<!DOCTYPE html>
<html>
<head>
<style>
  @page {
    size: letter;
    margin: 18mm 16mm;
  }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 9.3pt;
    line-height: 1.34;
  }
  .two-column {
    column-count: 2;
    column-gap: 8.5mm;
  }
  .span-all {
    column-span: all;
    background: #f1f5f9;
    border: 1px solid #94a3b8;
    padding: 10px;
    margin: 12px 0;
  }
</style>
</head>
<body>
<div class="two-column">
  <p>Left col text start. """ + ("Testing text filling up the columns properly. " * 40) + """</p>
  <div class="span-all">
    <h3>TABLE I: SPANNING BOTH COLUMNS BEAUTIFULLY</h3>
    <p>This table content spans across both columns from left margin to right margin, leaving zero blank gaps in either column!</p>
  </div>
  <p>Below span text. """ + ("Continuing text in two balanced columns below the spanning element. " * 50) + """</p>
</div>
</body>
</html>"""

with open('/tmp/test_span.html', 'w') as f:
    f.write(html)

subprocess.run([
    'google-chrome', '--headless', '--disable-gpu', '--no-pdf-header-footer',
    '--print-to-pdf=/tmp/test_span.pdf', 'file:///tmp/test_span.html'
], check=True)

res = subprocess.run(['pdfinfo', '/tmp/test_span.pdf'], capture_output=True, text=True)
for line in res.stdout.splitlines():
    if 'Pages:' in line:
        print(line)
