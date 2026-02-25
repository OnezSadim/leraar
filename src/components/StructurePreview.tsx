"use client";

import React, { useState } from "react";
import { Segment, SegmentType } from "@/lib/chunkingUtils";
import { useIngestion } from "./IngestionProvider";
import { refineStructureWithAI } from "@/app/actions/refineStructure";
import { ChevronDown, ChevronRight, GripVertical, Trash2, Edit3, Type, Wand2 } from "lucide-react";

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface StructurePreviewProps {
    itemId: string;
}

// Recursive component for rendering deep structure
function SortableSegmentNode({ segment, depth = 0, onUpdate, onRemove }: { segment: Segment, depth?: number, onUpdate: (id: string, updates: Partial<Segment>) => void, onRemove: (id: string, mergeContent: boolean) => void }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditingFullText, setIsEditingFullText] = useState(false);
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: segment.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 1.5}rem`
    };

    const isWrapper = segment.type !== "content";

    // Safe removal dialog
    const handleRemoveClick = () => {
        if (isWrapper && segment.children && segment.children.length > 0) {
            const confirmMerge = window.confirm(`Delete wrapper "${segment.title}"? \n\nClick OK to DELETE ALL its content forever.\nClick CANCEL to just remove the wrapper and keep its contents.`);
            onRemove(segment.id, !confirmMerge);
        } else {
            onRemove(segment.id, false);
        }
    };

    if (isEditingFullText) {
        return (
            <div ref={setNodeRef} style={style} className="bg-white border-2 border-indigo-400 p-4 rounded-xl shadow-lg my-3">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-indigo-700 flex items-center gap-2"><Edit3 size={16} /> Deep Editing Mode</h4>
                    <button onClick={() => setIsEditingFullText(false)} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 transition-colors">Done</button>
                </div>
                <p className="text-xs text-gray-500 mb-2">You have full control here. Insert `[SPLIT]` anywhere in the text to manually break this block into two.</p>
                <textarea
                    className="w-full h-48 p-3 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={segment.text || ""}
                    onChange={(e) => onUpdate(segment.id, { text: e.target.value })}
                />
            </div>
        )
    }

    return (
        <div ref={setNodeRef} style={style} className={`bg-white border border-gray-200 rounded-xl my-2 shadow-sm relative group overflow-hidden transition-colors ${isWrapper ? 'border-l-4 border-l-indigo-400' : 'border-l-4 border-l-gray-300'}`}>
            <div className="flex items-center gap-2 p-3 hover:bg-gray-50/50 transition-colors">

                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 rounded p-1">
                    <GripVertical size={16} />
                </div>

                {isWrapper && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-500 hover:bg-gray-100 p-1 rounded-md transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                )}

                {!isWrapper && (
                    <div className="p-1 rounded text-gray-400">
                        <Type size={16} />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    {isWrapper ? (
                        <input
                            value={segment.title || ""}
                            onChange={(e) => onUpdate(segment.id, { title: e.target.value })}
                            className="font-semibold text-gray-800 bg-transparent border-none outline-none w-full placeholder:text-gray-300 text-sm"
                            placeholder="Untitled Wrapper"
                        />
                    ) : (
                        <div className="text-sm text-gray-600 line-clamp-2 pr-12 cursor-text" onClick={() => setIsEditingFullText(true)}>
                            {segment.text}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur pl-2 rounded-l-lg shadow-[0_0_10px_10px_rgba(255,255,255,0.8)]">
                    {!isWrapper && (
                        <button onClick={() => setIsEditingFullText(true)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Deep Edit">
                            <Edit3 size={14} />
                        </button>
                    )}
                    <button onClick={handleRemoveClick} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Remove">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {isWrapper && isExpanded && segment.children && segment.children.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/30 p-2">
                    <SortableContext items={segment.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {segment.children.map(child => (
                            <SortableSegmentNode key={child.id} segment={child} depth={0} onUpdate={onUpdate} onRemove={onRemove} />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}

export function StructurePreview({ itemId }: StructurePreviewProps) {
    const { items, updateItemSegments } = useIngestion();
    const fileItem = items.find(i => i.id === itemId);
    const [isRefining, setIsRefining] = useState(false);

    if (!fileItem || !fileItem.segments || fileItem.segments.length === 0) return null;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // DFS update helper
    const updateSegmentRecursive = (segments: Segment[], id: string, updates: Partial<Segment>): Segment[] => {
        return segments.map(seg => {
            if (seg.id === id) return { ...seg, ...updates };
            if (seg.children) return { ...seg, children: updateSegmentRecursive(seg.children, id, updates) };
            return seg;
        });
    };

    const handleUpdateSegment = (id: string, updates: Partial<Segment>) => {
        const newSegments = updateSegmentRecursive(fileItem.segments, id, updates);
        updateItemSegments(itemId, newSegments);
    };

    // DFS remove helper
    const removeSegmentRecursive = (segments: Segment[], idToRemove: string, mergeContent: boolean): Segment[] => {
        let result: Segment[] = [];
        for (const seg of segments) {
            if (seg.id === idToRemove) {
                if (mergeContent && seg.children) {
                    // Push children up instead of deleting
                    result.push(...seg.children);
                }
                // Else if mergeContent is false, we just skip (deleting it and children)
            } else {
                if (seg.children) {
                    result.push({ ...seg, children: removeSegmentRecursive(seg.children, idToRemove, mergeContent) });
                } else {
                    result.push(seg);
                }
            }
        }
        return result;
    };

    const handleRemoveSegment = (id: string, mergeContent: boolean) => {
        const newSegments = removeSegmentRecursive(fileItem.segments, id, mergeContent);
        updateItemSegments(itemId, newSegments);
    };

    // Drag and Drop reordering (Simplified: assumes reordering within same level for now)
    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Due to nested nature, full generalized drag and drop between trees requires heavy tree traversal
        // For this iteration, we support sortable within the root level chunks. Advanced sub-nesting DnD requires more complex handlers.
        const oldIndex = fileItem.segments.findIndex(s => s.id === active.id);
        const newIndex = fileItem.segments.findIndex(s => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            updateItemSegments(itemId, arrayMove(fileItem.segments, oldIndex, newIndex));
        }
    };

    const handleAIRefine = async () => {
        if (!fileItem.contentText) return;
        setIsRefining(true);
        try {
            const newSegments = await refineStructureWithAI(fileItem.contentText);
            updateItemSegments(itemId, newSegments);
        } catch (error) {
            console.error(error);
            alert("Failed to refine structure. Please try again.");
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="mt-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-200 shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="font-bold text-gray-800">Structure Preview</h4>
                    <p className="text-xs text-gray-500">Edit, reorder, or organize the extracted semantic chunks before saving.</p>
                </div>
                <button
                    onClick={handleAIRefine}
                    disabled={isRefining}
                    className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm hover:shadow"
                >
                    {isRefining ? <span className="animate-spin">⧗</span> : <Wand2 size={16} />}
                    Auto-Format with AI
                </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fileItem.segments.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        {fileItem.segments.map(segment => (
                            <SortableSegmentNode
                                key={segment.id}
                                segment={segment}
                                onUpdate={handleUpdateSegment}
                                onRemove={handleRemoveSegment}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}
