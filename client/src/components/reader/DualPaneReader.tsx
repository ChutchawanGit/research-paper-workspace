import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { Paper, Highlight, Note, HighlightRect } from '../../types';
import { highlightsApi, notesApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { LogoutConfirmModal } from '../LogoutConfirmModal';
import { TipTapEditor } from './TipTapEditor';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  FileText,
  Download,
  Trash2,
  Share2,
  Check,
  MousePointer,
  Pencil,
  X,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Edit2,
  LogOut,
  Eye,
  EyeOff
} from 'lucide-react';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type ViewingMode = 'raw' | 'annotated' | 'edit';

interface DualPaneReaderProps {
  paper: Paper;
  pdfUrl: string;
  isPublic?: boolean;
  initialHighlights?: Highlight[];
  initialNotes?: Note[];
  onBack: () => void;
  onShare?: () => void;
}

// Helper to get pixel-perfect client rects strictly wrapping characters (ignoring linebreaks and empty trailing whitespace)
function getExactTextClientRects(range: Range, containerRect: DOMRect): HighlightRect[] {
  const rects: HighlightRect[] = [];
  const treeWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const text = textNode.nodeValue || '';

    let start = 0;
    let end = text.length;

    if (textNode === range.startContainer) {
      start = range.startOffset;
    }
    if (textNode === range.endContainer) {
      end = range.endOffset;
    }

    const selectedSlice = text.slice(start, end);
    if (selectedSlice.trim().length > 0) {
      // Exclude leading/trailing whitespace offsets
      const leadingSpace = selectedSlice.length - selectedSlice.trimStart().length;
      const trailingSpace = selectedSlice.length - selectedSlice.trimEnd().length;

      const trimmedStart = start + leadingSpace;
      const trimmedEnd = end - trailingSpace;

      if (trimmedStart < trimmedEnd) {
        const subRange = document.createRange();
        subRange.setStart(textNode, trimmedStart);
        subRange.setEnd(textNode, trimmedEnd);

        const subRects = subRange.getClientRects();
        for (let i = 0; i < subRects.length; i++) {
          const r = subRects[i];
          // Filter out empty or whitespace/linebreak phantom rects
          if (r.width > 2 && r.height > 2) {
            rects.push({
              x: (r.left - containerRect.left) / containerRect.width,
              y: (r.top - containerRect.top) / containerRect.height,
              width: r.width / containerRect.width,
              height: r.height / containerRect.height,
            });
          }
        }
      }
    }

    currentNode = treeWalker.nextNode();
  }

  // Fallback safely if treeWalker didn't find multiple nodes
  if (rects.length === 0) {
    const clientRects = range.getClientRects();
    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      if (r.width > 2 && r.height > 2) {
        rects.push({
          x: (r.left - containerRect.left) / containerRect.width,
          y: (r.top - containerRect.top) / containerRect.height,
          width: r.width / containerRect.width,
          height: r.height / containerRect.height,
        });
      }
    }
  }

  return rects;
}

export const DualPaneReader: React.FC<DualPaneReaderProps> = ({
  paper,
  pdfUrl,
  isPublic = false,
  initialHighlights,
  initialNotes,
  onBack,
  onShare,
}) => {
  // Auth & Logout
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(paper.page_count || 1);
  const [scale, setScale] = useState(1.15);
  const [loadingPdf, setLoadingPdf] = useState(true);

  // Viewing Mode:
  // - 'raw': original clean PDF (no highlights/notes)
  // - 'annotated': read-only view with highlights & sticky notes
  // - 'edit': full editing and annotating
  const [viewingMode, setViewingMode] = useState<ViewingMode>(isPublic ? 'annotated' : 'edit');

  // Tools & UI Mode: 'select' for text selection, 'draw' for drag-box highlighting
  const [toolMode, setToolMode] = useState<'select' | 'draw'>('select');
  const [showRightPane, setShowRightPane] = useState(false);

  // Annotations state
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights || []);
  const [notes, setNotes] = useState<Note[]>(initialNotes || []);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  // Drag-to-Highlight State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawBox, setCurrentDrawBox] = useState<HighlightRect | null>(null);

  // Active On-Page Annotation Card (for creating a new highlight + note right on the page)
  const [newAnnotation, setNewAnnotation] = useState<{
    rects: HighlightRect[];
    selectedText: string;
    pos: { x: number; y: number };
  } | null>(null);
  const [annotationNoteText, setAnnotationNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FBBF24');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Sticky Note Inspection on Page (clicking an existing highlight/note pin)
  const [inspectedHighlight, setInspectedHighlight] = useState<Highlight | null>(null);
  const [editingInspectedNote, setEditingInspectedNote] = useState(false);
  const [inspectedNoteContent, setInspectedNoteContent] = useState('');

  // Right pane main note state
  const [mainNoteContent, setMainNoteContent] = useState('');
  const [mainNoteId, setMainNoteId] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoadingPdf(true);

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: true,
    });

    loadingTask.promise
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoadingPdf(false);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          console.error('Failed to load PDF', err);
          setLoadingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // Load Highlights and Notes (if not public)
  useEffect(() => {
    if (isPublic) return;

    highlightsApi.list(paper.id).then((res) => setHighlights(res.data)).catch(() => {});
    notesApi.list(paper.id).then((res) => {
      setNotes(res.data);
      const generalNote = res.data.find((n) => !n.highlight_id);
      if (generalNote) {
        setMainNoteContent(generalNote.content);
        setMainNoteId(generalNote.id);
      }
    }).catch(() => {});
  }, [paper.id, isPublic]);

  // Render current page with Canvas AND TextLayer
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

      // Render native interactive Text Layer for selecting text on the page
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport: viewport,
        });
        await textLayer.render();
      }
    } catch (err: unknown) {
      console.error('Render page error', err);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Handle native text selection (Mode 1: Text Selection Tool)
  const handleTextMouseUp = () => {
    if (isPublic || viewingMode !== 'edit' || toolMode !== 'select') return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const containerRect = containerRef.current.getBoundingClientRect();

    // Use tight text walker to calculate rects ONLY for characters (never trailing whitespace/newlines)
    const normalizedRects = getExactTextClientRects(range, containerRect);
    if (normalizedRects.length === 0) return;

    const lastRect = normalizedRects[normalizedRects.length - 1];
    const pixelX = lastRect.x * containerRect.width;
    const pixelY = (lastRect.y + lastRect.height) * containerRect.height + 8;

    const cardWidth = 320;
    const cardHeight = 220;
    const posX = Math.max(10, Math.min(pixelX, containerRect.width - cardWidth - 10));
    let posY = pixelY;
    if (posY + cardHeight > containerRect.height) {
      posY = Math.max(10, lastRect.y * containerRect.height - cardHeight - 8);
    }

    setNewAnnotation({
      rects: normalizedRects,
      selectedText: text,
      pos: { x: posX, y: posY },
    });
    setAnnotationNoteText('');
  };

  // Extract tight text spans within a drawn bounding box (never extending to the right margin)
  const extractTightTextAndRectsInBox = (
    box: HighlightRect,
    containerRect: DOMRect
  ): { rects: HighlightRect[]; text: string } => {
    if (!textLayerRef.current) return { rects: [box], text: '' };

    const boxLeft = containerRect.left + box.x * containerRect.width;
    const boxTop = containerRect.top + box.y * containerRect.height;
    const boxRight = containerRect.left + (box.x + box.width) * containerRect.width;
    const boxBottom = containerRect.top + (box.y + box.height) * containerRect.height;

    const spans = textLayerRef.current.querySelectorAll('span');
    const words: string[] = [];
    const tightRects: HighlightRect[] = [];

    spans.forEach((span) => {
      const sRect = span.getBoundingClientRect();
      const intersects = !(
        sRect.right < boxLeft ||
        sRect.left > boxRight ||
        sRect.bottom < boxTop ||
        sRect.top > boxBottom
      );

      if (intersects && span.textContent && span.textContent.trim()) {
        words.push(span.textContent.trim());

        // Clamp the highlight strictly to the span bounds (never extending beyond the span to the right!)
        const clampLeft = Math.max(sRect.left, boxLeft);
        const clampRight = Math.min(sRect.right, boxRight);
        const clampTop = Math.max(sRect.top, boxTop);
        const clampBottom = Math.min(sRect.bottom, boxBottom);

        if (clampRight > clampLeft && clampBottom > clampTop) {
          tightRects.push({
            x: (clampLeft - containerRect.left) / containerRect.width,
            y: (clampTop - containerRect.top) / containerRect.height,
            width: (clampRight - clampLeft) / containerRect.width,
            height: (clampBottom - clampTop) / containerRect.height,
          });
        }
      }
    });

    const text = words.join(' ');
    return {
      rects: tightRects.length > 0 ? tightRects : [box],
      text: text,
    };
  };

  // Drag-to-Box Highlight (Mode 2: Drag Area / Box Tool)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPublic || viewingMode !== 'edit' || toolMode !== 'draw' || !containerRef.current) return;
    // Ignore if clicking inside active cards or sticky pins
    const target = e.target as HTMLElement;
    if (target.closest('.annotation-card') || target.closest('.note-pin')) return;

    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const startY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setIsDrawing(true);
    setDrawStart({ x: startX, y: startY });
    setCurrentDrawBox({ x: startX, y: startY, width: 0, height: 0 });
    setNewAnnotation(null);
    setInspectedHighlight(null);
  };

  // Global window listeners while drawing so mouse drag works everywhere smoothly
  useEffect(() => {
    if (!isDrawing) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!isDrawing || !drawStart || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const x = Math.min(drawStart.x, currentX);
      const y = Math.min(drawStart.y, currentY);
      const width = Math.abs(currentX - drawStart.x);
      const height = Math.abs(currentY - drawStart.y);

      setCurrentDrawBox({ x, y, width, height });
    };

    const onWindowMouseUp = () => {
      if (!isDrawing || !drawStart || !containerRef.current) {
        setIsDrawing(false);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = currentDrawBox?.x || drawStart.x;
      const y = currentDrawBox?.y || drawStart.y;
      const width = currentDrawBox?.width || 0;
      const height = currentDrawBox?.height || 0;

      setIsDrawing(false);
      setCurrentDrawBox(null);
      setDrawStart(null);

      // Trigger if box size > 1% width and > 0.5% height
      if (width > 0.012 && height > 0.008) {
        const rawBox: HighlightRect = { x, y, width, height };
        const { rects: tightRects, text: extracted } = extractTightTextAndRectsInBox(rawBox, rect);
        const snippet = extracted || `Selected Area (Page ${currentPage})`;

        const cardWidth = 320;
        const cardHeight = 220;
        const pixelX = x * rect.width;
        const posX = Math.max(10, Math.min(pixelX, rect.width - cardWidth - 10));

        let posY = (y + height) * rect.height + 10;
        if (posY + cardHeight > rect.height) {
          posY = Math.max(10, y * rect.height - cardHeight - 10);
        }

        setNewAnnotation({
          rects: tightRects,
          selectedText: snippet,
          pos: { x: posX, y: posY },
        });
        setAnnotationNoteText('');
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isDrawing, drawStart, currentDrawBox, currentPage]);

  // Save On-Page Highlight & Note
  const handleSaveOnPageAnnotation = async (withNote = true) => {
    if (!newAnnotation) return;
    setSavingAnnotation(true);

    try {
      // 1. Create Highlight
      const hlRes = await highlightsApi.create(paper.id, {
        page_index: currentPage,
        rects: newAnnotation.rects,
        selected_text: newAnnotation.selectedText,
        color: selectedColor,
      });

      const savedHl = hlRes.data;
      setHighlights((prev) => [...prev, savedHl]);

      // 2. Create Note attached directly to this highlight (if note text is provided)
      if (withNote && annotationNoteText.trim()) {
        const noteRes = await notesApi.create(paper.id, {
          title: `Note: ${newAnnotation.selectedText.slice(0, 40)}`,
          content: annotationNoteText.trim(),
          highlight_id: savedHl.id,
        });
        setNotes((prev) => [...prev, noteRes.data]);
      }

      setNewAnnotation(null);
      setAnnotationNoteText('');
      window.getSelection()?.removeAllRanges();
    } catch (err: unknown) {
      alert('Failed to save highlight and note.');
    } finally {
      setSavingAnnotation(false);
    }
  };

  // Inspect existing highlight / sticky note on page
  const handleOpenHighlight = (hl: Highlight) => {
    if (viewingMode === 'raw') return;
    setInspectedHighlight(hl);
    const existingNote = notes.find((n) => n.highlight_id === hl.id);
    if (existingNote) {
      setInspectedNoteContent(existingNote.content);
    } else {
      setInspectedNoteContent('');
    }
    setEditingInspectedNote(false);
    setActiveHighlightId(hl.id);
  };

  // Save edited note for inspected highlight
  const handleSaveInspectedNote = async () => {
    if (!inspectedHighlight) return;
    const existingNote = notes.find((n) => n.highlight_id === inspectedHighlight.id);

    try {
      if (existingNote) {
        const updated = await notesApi.update(existingNote.id, {
          title: existingNote.title || 'Note',
          content: inspectedNoteContent,
          highlight_id: inspectedHighlight.id,
        });
        setNotes((prev) => prev.map((n) => (n.id === existingNote.id ? updated.data : n)));
      } else {
        const created = await notesApi.create(paper.id, {
          title: `Note: ${inspectedHighlight.selected_text.slice(0, 40)}`,
          content: inspectedNoteContent,
          highlight_id: inspectedHighlight.id,
        });
        setNotes((prev) => [...prev, created.data]);
      }
      setEditingInspectedNote(false);
    } catch (err: unknown) {
      alert('Failed to update note');
    }
  };

  // Delete Highlight and its attached note
  const handleDeleteHighlight = async (id: string) => {
    try {
      await highlightsApi.delete(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      setNotes((prev) => prev.filter((n) => n.highlight_id !== id));
      if (inspectedHighlight?.id === id) {
        setInspectedHighlight(null);
      }
    } catch (err: unknown) {
      alert('Failed to delete highlight');
    }
  };

  // Save General Synthesis Note in Right Pane
  const handleSaveMainNote = async () => {
    setSavingNote(true);
    try {
      if (mainNoteId) {
        await notesApi.update(mainNoteId, {
          title: 'Paper Synthesis Notes',
          content: mainNoteContent,
        });
      } else {
        const res = await notesApi.create(paper.id, {
          title: 'Paper Synthesis Notes',
          content: mainNoteContent,
        });
        setMainNoteId(res.data.id);
      }
      setNoteSavedFeedback(true);
      setTimeout(() => setNoteSavedFeedback(false), 2000);
    } catch (err: unknown) {
      alert('Failed to save notes');
    } finally {
      setSavingNote(false);
    }
  };

  // Export Notes as Markdown file
  const handleExportNotes = () => {
    const header = `# Reading Notes: ${paper.title}\n\n**Authors:** ${paper.authors}\n**Status:** ${paper.reading_status}\n\n---\n\n## Synthesis\n\n`;
    const cleanContent = mainNoteContent
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ');

    let highlightsText = '\n\n---\n\n## On-Page Highlights & Sticky Notes\n\n';
    highlights.forEach((hl, i) => {
      const attachedNote = notes.find((n) => n.highlight_id === hl.id);
      highlightsText += `### [Page ${hl.page_index}] Highlight ${i + 1}\n> "${hl.selected_text}"\n`;
      if (attachedNote) {
        highlightsText += `\n**Attached Note:**\n${attachedNote.content}\n`;
      }
      highlightsText += '\n';
    });

    const fullBlob = new Blob([header + cleanContent + highlightsText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(fullBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highlightColors = ['#FBBF24', '#34D399', '#60A5FA', '#F472B6'];

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Header Controls Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30 shadow-md">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 truncate max-w-sm">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="truncate">
            <h2 className="text-sm font-bold text-white truncate">{paper.title}</h2>
            <p className="text-[11px] text-slate-400 truncate">{paper.authors || 'Research Paper'}</p>
          </div>
        </div>

        {/* Center: Viewing Mode + Tool Modes + Pagination */}
        <div className="flex items-center gap-2.5">
          {/* Segmented Viewing Mode: Raw vs Annotated vs Edit */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => {
                setViewingMode('raw');
                setNewAnnotation(null);
                setInspectedHighlight(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewingMode === 'raw'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="อ่านข้อมูลดิบ (ซ่อนไฮไลต์และโน้ตทั้งหมด)"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>ข้อมูลดิบ (Raw)</span>
            </button>

            <button
              onClick={() => {
                setViewingMode('annotated');
                setNewAnnotation(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewingMode === 'annotated'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="อ่านพร้อมไฮไลต์และโน้ต (โหมดอ่านอย่างเดียว)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>อ่านพร้อมโน้ต</span>
            </button>

            {!isPublic && (
              <button
                onClick={() => setViewingMode('edit')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewingMode === 'edit'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="โหมดแก้ไขและจดโน้ตเพิ่มเติม"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>จดโน้ต (Edit)</span>
              </button>
            )}
          </div>

          {/* Sub-tool Selector (Only visible in 'edit' mode) */}
          {viewingMode === 'edit' && !isPublic && (
            <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
              <button
                onClick={() => {
                  setToolMode('select');
                  setIsDrawing(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  toolMode === 'select'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="โหมดเลือกข้อความ (Text Selection)"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Select</span>
              </button>

              <button
                onClick={() => {
                  setToolMode('draw');
                  window.getSelection()?.removeAllRanges();
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  toolMode === 'draw'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="โหมดลากครอบพื้นที่ (Drag to Note)"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Drag to Note</span>
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700/60">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-300 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setScale((s) => Math.max(s - 0.15, 0.6))}
              className="p-1 rounded text-slate-300 hover:bg-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-slate-400 px-1">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(s + 0.15, 2.2))}
              className="p-1 rounded text-slate-300 hover:bg-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportNotes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
            title="Download Notes & Highlights as Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Notes</span>
          </button>

          {!isPublic && onShare && (
            <button
              onClick={onShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          )}

          {/* Toggle Full-screen PDF vs Split Pane */}
          <button
            onClick={() => setShowRightPane(!showRightPane)}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
              showRightPane
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={showRightPane ? 'Collapse Synthesis Pane' : 'Open Synthesis Pane'}
          >
            {showRightPane ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>

          {!isPublic && (
            <button
              onClick={() => setShowLogoutModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Main Reader View */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Canvas Viewport */}
        <div className="flex-1 bg-slate-950 overflow-auto flex justify-center p-6 relative select-text">
          {/* Floating mode banner helpers */}
          {viewingMode === 'raw' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-emerald-700/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none animate-in fade-in duration-150">
              <EyeOff className="w-3.5 h-3.5" />
              <span>โหมดข้อมูลดิบ: ซ่อนไฮไลต์และโน้ตทั้งหมดสำหรับอ่านเอกสารต้นฉบับ</span>
            </div>
          )}

          {viewingMode === 'annotated' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-700/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none animate-in fade-in duration-150">
              <Eye className="w-3.5 h-3.5" />
              <span>โหมดอ่านพร้อมโน้ต (Read-Only): คลิกที่ไฮไลต์หรือหมุด 💬 เพื่ออ่านโน้ต</span>
            </div>
          )}

          {viewingMode === 'edit' && toolMode === 'draw' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none animate-in fade-in duration-150">
              <Pencil className="w-3.5 h-3.5" />
              <span>โหมด Drag to Note: คลิกและลากเมาส์ครอบข้อความเพื่อจดโน้ต</span>
            </div>
          )}

          {loadingPdf ? (
            <div className="flex flex-col items-center justify-center my-auto text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-sm">Rendering PDF document...</span>
            </div>
          ) : (
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseUp={() => {
                if (viewingMode === 'edit' && toolMode === 'select') {
                  handleTextMouseUp();
                }
              }}
              style={{
                userSelect: isDrawing || (viewingMode === 'edit' && toolMode === 'draw') ? 'none' : 'auto',
              }}
              className={`relative shadow-2xl bg-white rounded-sm my-auto inline-block ${
                viewingMode === 'edit' && toolMode === 'draw' ? 'cursor-crosshair' : 'cursor-text'
              }`}
            >
              {/* PDF Canvas */}
              <canvas ref={canvasRef} className="block select-text" />

              {/* Native PDF.js Text Layer (Enables real selectable text matching PDF coordinates) */}
              <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text overflow-hidden pointer-events-auto"
                style={{
                  pointerEvents: viewingMode === 'edit' && toolMode === 'draw' ? 'none' : 'auto',
                }}
              />

              {/* Real-time Drag Box Preview (while user is dragging in 'draw' mode) */}
              {isDrawing && currentDrawBox && (
                <div
                  className="absolute border-2 border-dashed border-amber-500 bg-amber-400/30 rounded-sm pointer-events-none z-30 shadow-sm"
                  style={{
                    left: `${currentDrawBox.x * 100}%`,
                    top: `${currentDrawBox.y * 100}%`,
                    width: `${currentDrawBox.width * 100}%`,
                    height: `${currentDrawBox.height * 100}%`,
                  }}
                />
              )}

              {/* Saved Highlights on Current Page (Hidden in 'raw' mode) */}
              {viewingMode !== 'raw' &&
                highlights
                  .filter((h) => h.page_index === currentPage)
                  .map((hl) => {
                    const hasNote = notes.some((n) => n.highlight_id === hl.id);
                    const firstRect = hl.rects[0];

                    return (
                      <React.Fragment key={hl.id}>
                        {hl.rects.map((r, i) => (
                          <div
                            key={i}
                            onClick={() => handleOpenHighlight(hl)}
                            className={`absolute cursor-pointer transition-opacity z-10 ${
                              activeHighlightId === hl.id
                                ? 'opacity-85 ring-2 ring-blue-500 ring-offset-1'
                                : 'opacity-40 hover:opacity-75'
                            }`}
                            style={{
                              left: `${r.x * 100}%`,
                              top: `${r.y * 100}%`,
                              width: `${r.width * 100}%`,
                              height: `${r.height * 100}%`,
                              backgroundColor: hl.color || '#FBBF24',
                            }}
                            title={hl.selected_text}
                          />
                        ))}

                        {/* Sticky Note Pin right on the PDF page */}
                        {hasNote && firstRect && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHighlight(hl);
                            }}
                            className="note-pin absolute z-20 -translate-y-1/2 p-1 rounded-full bg-blue-600 text-white shadow-md hover:scale-125 transition-transform"
                            style={{
                              left: `${Math.min((firstRect.x + firstRect.width) * 100 + 0.5, 96)}%`,
                              top: `${firstRect.y * 100}%`,
                            }}
                            title="Click to view/edit on-page note"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })}

              {/* DIRECT ON-PAGE ANNOTATION CARD (Only in 'edit' mode) */}
              {viewingMode === 'edit' && newAnnotation && (
                <div
                  className="annotation-card absolute z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 w-80 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    left: `${newAnnotation.pos.x}px`,
                    top: `${newAnnotation.pos.y}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Highlighter className="w-3.5 h-3.5 text-blue-600" />
                      <span>จดโน้ตบนเอกสาร</span>
                    </span>

                    {/* Color Circles */}
                    <div className="flex items-center gap-1">
                      {highlightColors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform ${
                            selectedColor === c ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <button
                        onClick={() => setNewAnnotation(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 ml-1 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Excerpt preview */}
                  <p className="text-[11px] text-slate-500 italic line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2.5">
                    "{newAnnotation.selectedText}"
                  </p>

                  {/* Direct Note Input Box */}
                  <textarea
                    autoFocus
                    rows={3}
                    value={annotationNoteText}
                    onChange={(e) => setAnnotationNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        handleSaveOnPageAnnotation(true);
                      }
                    }}
                    placeholder="พิมพ์โน้ตสำหรับจุดนี้... (กด ⌘+Enter เพื่อบันทึก)"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none mb-3"
                  />

                  {/* Save Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveOnPageAnnotation(false)}
                      disabled={savingAnnotation}
                      className="px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                      ไฮไลต์อย่างเดียว
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveOnPageAnnotation(true)}
                      disabled={savingAnnotation}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      <span>{savingAnnotation ? 'กำลังบันทึก...' : 'บันทึกโน้ต'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* INSPECTED ON-PAGE STICKY NOTE CARD (Read-only in 'annotated' mode, Editable in 'edit' mode) */}
              {viewingMode !== 'raw' && inspectedHighlight && (
                <div
                  className="annotation-card absolute z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-80 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    left: `${Math.min(inspectedHighlight.rects[0]?.x * 100 || 10, 65)}%`,
                    top: `${Math.min((inspectedHighlight.rects[0]?.y || 10) * 100 + 4, 80)}%`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: inspectedHighlight.color || '#FBBF24' }}
                      />
                      <span>โน้ตในหน้า {inspectedHighlight.page_index}</span>
                      {viewingMode === 'annotated' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-normal">
                          Read-Only
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!isPublic && viewingMode === 'edit' && (
                        <button
                          onClick={() => handleDeleteHighlight(inspectedHighlight.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="Delete highlight"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setInspectedHighlight(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Selected Excerpt */}
                  <p className="text-[11px] text-slate-500 italic line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
                    "{inspectedHighlight.selected_text}"
                  </p>

                  {/* Note Body */}
                  {editingInspectedNote && viewingMode === 'edit' ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={inspectedNoteContent}
                        onChange={(e) => setInspectedNoteContent(e.target.value)}
                        placeholder="พิมพ์โน้ตของคุณที่นี่..."
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingInspectedNote(false)}
                          className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInspectedNote}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md"
                        >
                          บันทึก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {inspectedNoteContent ? (
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mb-3">
                          {inspectedNoteContent}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mb-3">
                          ยังไม่มีข้อความโน้ตในจุดนี้
                        </p>
                      )}

                      {!isPublic && viewingMode === 'edit' && (
                        <button
                          type="button"
                          onClick={() => setEditingInspectedNote(true)}
                          className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{inspectedNoteContent ? 'แก้ไขโน้ต' : '+ จดโน้ตตรงนี้'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Optional Collapsible Right Pane: General Synthesis Notes */}
        {showRightPane && (
          <div className="w-[420px] bg-white text-slate-900 border-l border-slate-200 flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Paper Synthesis Notes</span>
              </span>

              {!isPublic && viewingMode === 'edit' && (
                <button
                  onClick={handleSaveMainNote}
                  disabled={savingNote}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {noteSavedFeedback ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <span>{savingNote ? 'Saving...' : 'Save Notes'}</span>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 p-4 overflow-hidden">
              <TipTapEditor
                content={mainNoteContent}
                onChange={setMainNoteContent}
                editable={!isPublic && viewingMode === 'edit'}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
