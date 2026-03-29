"""Compatibility launcher for the relocated scraper module."""

from pipeline.script import get_parent_portal_info  # re-export for backend imports


if __name__ == '__main__':
    import runpy
    from pathlib import Path

    target = Path(__file__).resolve().parent / 'pipeline' / 'script.py'
    runpy.run_path(str(target), run_name='__main__')
