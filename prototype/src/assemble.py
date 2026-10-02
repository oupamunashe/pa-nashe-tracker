"""Rebuild prototype/index.html from the split sources (reference only)."""
from pathlib import Path
here = Path(__file__).parent
parts = [(here / f).read_text() for f in ['core.js', 'ui1.js', 'ui2.js', 'ui3.js', 'io.js']]
css = (here / 'app.css').read_text()
head = (here.parent / 'index.html').read_text().split('<style>')[0]
(here.parent / 'index.html').write_text(f"{head}<style>\n{css}\n</style>\n</head>\n<body>\n<script>\n" + "\n".join(parts) + "\n</script>\n</body>\n</html>")
print('rebuilt prototype/index.html')
