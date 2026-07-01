"""A ttk theme approximating the web app's dark, desaturated palette (see
src/index.css :root tokens) so the desktop app feels like the same product."""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk

BG = "#0d0e10"
SURFACE = "#15171a"
SURFACE_2 = "#1b1e22"
BORDER = "#2a2f36"
TEXT = "#e7e9ec"
TEXT_DIM = "#98a0aa"
TEXT_FAINT = "#6b727c"
ACCENT = "#5b94c4"
POS = "#58a06a"
NEG = "#cf5b52"
WARN = "#cf9a4d"

FONT = ("Helvetica", 10)
FONT_BOLD = ("Helvetica", 10, "bold")
FONT_MONO = ("Courier New", 10)
FONT_TITLE = ("Helvetica", 13, "bold")


def apply(root: tk.Tk) -> ttk.Style:
    root.configure(bg=BG)
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except tk.TclError:
        pass

    style.configure(".", background=BG, foreground=TEXT, font=FONT)
    style.configure("TFrame", background=BG)
    style.configure("Surface.TFrame", background=SURFACE, relief="flat")
    style.configure("Card.TLabelframe", background=SURFACE, foreground=TEXT, bordercolor=BORDER)
    style.configure("Card.TLabelframe.Label", background=SURFACE, foreground=TEXT_DIM, font=FONT_BOLD)
    style.configure("TLabel", background=BG, foreground=TEXT, font=FONT)
    style.configure("Surface.TLabel", background=SURFACE, foreground=TEXT, font=FONT)
    style.configure("Dim.TLabel", background=BG, foreground=TEXT_DIM, font=FONT)
    style.configure("SurfaceDim.TLabel", background=SURFACE, foreground=TEXT_DIM, font=FONT)
    style.configure("Faint.TLabel", background=BG, foreground=TEXT_FAINT, font=FONT)
    style.configure("Pos.TLabel", background=SURFACE, foreground=POS, font=FONT_BOLD)
    style.configure("Neg.TLabel", background=SURFACE, foreground=NEG, font=FONT_BOLD)
    style.configure("Warn.TLabel", background=SURFACE, foreground=WARN, font=FONT_BOLD)
    style.configure("Title.TLabel", background=BG, foreground=TEXT, font=FONT_TITLE)
    style.configure("SurfaceTitle.TLabel", background=SURFACE, foreground=TEXT, font=FONT_TITLE)

    style.configure("TNotebook", background=BG, bordercolor=BORDER)
    style.configure("TNotebook.Tab", background=SURFACE_2, foreground=TEXT_DIM, padding=(10, 6))
    style.map("TNotebook.Tab", background=[("selected", SURFACE)], foreground=[("selected", TEXT)])

    style.configure("TButton", background=SURFACE_2, foreground=TEXT, bordercolor=BORDER, padding=6)
    style.map("TButton", background=[("active", SURFACE)])
    style.configure("Accent.TButton", background=ACCENT, foreground="#07151f")
    style.map("Accent.TButton", background=[("active", "#6fa6d6")])

    style.configure("TEntry", fieldbackground=SURFACE_2, foreground=TEXT, insertcolor=TEXT)
    style.configure("TCombobox", fieldbackground=SURFACE_2, foreground=TEXT, background=SURFACE_2)
    style.configure("TCheckbutton", background=BG, foreground=TEXT)
    style.configure("TRadiobutton", background=BG, foreground=TEXT)

    style.configure("Treeview", background=SURFACE, fieldbackground=SURFACE, foreground=TEXT, bordercolor=BORDER)
    style.configure("Treeview.Heading", background=SURFACE_2, foreground=TEXT_DIM)
    style.map("Treeview", background=[("selected", ACCENT)], foreground=[("selected", "#07151f")])

    return style


def sentiment_style(sentiment: str) -> str:
    if sentiment == "Bullish":
        return "Pos.TLabel"
    if sentiment == "Bearish":
        return "Neg.TLabel"
    return "SurfaceDim.TLabel"


def impact_style(impact: str) -> str:
    if impact == "High":
        return "Neg.TLabel"
    if impact == "Medium":
        return "Warn.TLabel"
    return "SurfaceDim.TLabel"
