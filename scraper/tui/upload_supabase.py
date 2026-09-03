#!/usr/bin/env python3
"""Shim — the old Supabase uploader was moved, not deleted.

See scraper/_can_possibly_delete/python-supabase/README.old.md
"""
from pathlib import Path
import runpy
import sys

_tui = Path(__file__).resolve().parent
_target = _tui.parent / "_can_possibly_delete" / "python-supabase" / "upload_supabase.py"
sys.path.insert(0, str(_tui))
sys.argv[0] = str(_target)
runpy.run_path(str(_target), run_name="__main__")
