"use client";

import React, { useCallback, useRef, useState } from "react";
import { useIngestion, IngestionItem } from "./IngestionProvider";
import { sanitizeHTML } from "@/lib/documentUtils";
import { StructurePreview } from "./StructurePreview";
import { UploadCloud, FileType as FileIcon, Image as ImageIcon, Video, FileText, X, CheckCircle2, Loader2, GripVertical, AlertCircle } from "lucide-react";
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

function SortableIngestionItem({ item }: { item: IngestionItem }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const { updateItemDescription, updateVideoUrl, updateItemTags, updateOriginalMaterialId, removeItem } = useIngestion();

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const getIcon = () => {
        switch (item.type) {
            case "pdf": return <FileText className="text-red-500" />;
            case "word": return <FileText className="text-blue-500" />;
            case "image": return <ImageIcon className="text-emerald-500" />;
            case "video": return <Video className="text-purple-500" />;
            default: return <FileIcon className="text-gray-400" />;
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="flex gap-4 p-4 mb-3 bg-white/50 backdrop-blur-md border border-white/20 shadow-sm rounded-xl relative group">

            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                <GripVertical size={20} />
            </div>

            {/* Icon & Status */}
            <div className="flex flex-col items-center justify-center w-12 gap-2">
                {getIcon()}
                {item.status === "processing" && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                {item.status === "done" && <CheckCircle2 size={16} className="text-emerald-500" />}
                {item.status === "error" && <AlertCircle size={16} className="text-red-500" />}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 truncate">{item.originalName}</h4>
                    <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded-full">{item.status}</span>
                </div>

                <p className="text-sm text-gray-600 line-clamp-1">{item.progressMessage}</p>

                {item.type === "video" && (
                    <input
                        type="url"
                        placeholder="Paste original video URL here (Youtube, Vimeo, etc...)"
                        className="mt-2 text-sm p-2 w-full rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        value={item.videoSourceUrl || ""}
                        onChange={(e) => updateVideoUrl(item.id, e.target.value)}
                    />
                )}

                <textarea
                    placeholder="Notes or description about this file..."
                    className="mt-1 text-sm p-2 rounded-lg border border-gray-100 bg-white/50 focus:bg-white resize-none h-20 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={item.description}
                    onChange={(e) => updateItemDescription(item.id, e.target.value)}
                />

                {/* Sub-Metadata tags */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                        type="text"
                        placeholder="Subject tags (e.g. math, biology)"
                        className="text-xs p-2 rounded border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none w-full bg-white/50"
                        value={item.subjectTags.join(", ")}
                        onChange={(e) => updateItemTags(item.id, 'subject', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    />
                    <input
                        type="text"
                        placeholder="Ed System (e.g. AP, IB, VWO)"
                        className="text-xs p-2 rounded border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none w-full bg-white/50"
                        value={item.educationSystemTags.join(", ")}
                        onChange={(e) => updateItemTags(item.id, 'educationSystem', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    />
                </div>

                {/* Duplicate Warning Modal / Block */}
                {item.duplicateMatches && item.duplicateMatches.length > 0 && !item.originalMaterialId && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
                        <div className="flex items-start gap-2 text-amber-800">
                            <AlertCircle size={16} className="mt-0.5" />
                            <div className="flex-1">
                                <h5 className="text-sm font-bold">Similar Materials Found!</h5>
                                <p className="text-xs mt-1 text-amber-700">We found materials in the global library that match what you're trying to upload. Would you like to fork the existing material to avoid redundancy?</p>
                                <ul className="mt-2 space-y-2">
                                    {item.duplicateMatches.map(match => (
                                        <li key={match.id} className="flex items-center justify-between bg-white p-2 rounded border border-amber-100 shadow-sm text-xs">
                                            <span className="font-semibold truncate pr-2 max-w-[200px]" title={match.title}>{match.title}</span>
                                            <button
                                                onClick={() => updateOriginalMaterialId(item.id, match.id)}
                                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded transition-colors font-medium shrink-0"
                                            >
                                                Fork This
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => updateOriginalMaterialId(item.id, null)}
                                    className="text-xs text-amber-600 hover:text-amber-800 font-medium mt-3 underline"
                                >
                                    Dismiss & Upload Anyway
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Fork UI Block */}
                {item.originalMaterialId && (
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                        <div className="flex items-start gap-2 text-indigo-800">
                            <CheckCircle2 size={16} className="mt-0.5" />
                            <div className="flex-1">
                                <h5 className="text-sm font-bold">Material Forked</h5>
                                <p className="text-xs mt-1 text-indigo-700">You are creating a fork of an existing document. Your edits and structure won't mutate the original.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Remove Button */}
            <button
                onClick={() => removeItem(item.id)}
                className="absolute -top-2 -right-2 bg-white border border-gray-200 text-gray-400 hover:text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
                <X size={14} />
            </button>

            {/* Thumbnail Preview */}
            {item.images.length > 0 && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50 flex items-center justify-center relative">
                    <img src={item.images[0]} alt="preview" className="object-cover w-full h-full" />
                    {item.images.length > 1 && (
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">
                            +{item.images.length - 1}
                        </div>
                    )}
                </div>
            )}

            {/* Semantic Chunks Interactive Preview */}
            {item.status === "done" && item.type !== "image" && item.type !== "video" && (
                <div className="w-full mt-4 border-t border-gray-100 pt-4">
                    <StructurePreview itemId={item.id} />
                </div>
            )}
        </div>
    );
}


export function GreenIngestionZone() {
    const { items, addFiles, reorderItems } = useIngestion();
    const [isDragging, setIsDragging] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        usePointerSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useKeyboardSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    }, [addFiles]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
    };

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const filesToProcess: File[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) filesToProcess.push(file);
            } else if (item.kind === 'string' && item.type === 'text/html') {
                item.getAsString((htmlStr) => {
                    const cleaned = sanitizeHTML(htmlStr);
                    const file = new File([cleaned], "Pasted HTML.html", { type: "text/plain" });
                    addFiles([file]);
                });
            } else if (item.kind === 'string' && item.type === 'text/plain') {
                item.getAsString((textStr) => {
                    const file = new File([textStr], "Pasted Text.txt", { type: "text/plain" });
                    addFiles([file]);
                });
            }
        }

        if (filesToProcess.length > 0) {
            addFiles(filesToProcess);
        }
        e.preventDefault(); // Stop standard pasting in the editable div
    }, [addFiles]);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over.id);
            reorderItems(oldIndex, newIndex);
        }
    };

    return (
        <div className="max-w-4xl w-full mx-auto space-y-8">

            {/* Upload & Paste Zone */}
            <div
                ref={dropRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden
          ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-gray-300 hover:border-indigo-400 bg-white/40'}
        `}
            >
                <div className="absolute inset-0 -z-10 bg-gradient-to-vr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="bg-white p-4 rounded-full shadow-sm mb-4 border border-indigo-100 group-hover:scale-110 transition-transform">
                    <UploadCloud className="text-indigo-500" size={32} />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">Upload or Paste Media</h3>
                <p className="text-gray-500 mb-6 max-w-sm">
                    Drag and drop PDFs, Word docs, images or videos here. We extract text and compress media locally to save bandwidth.
                </p>

                {/* Hidden File Input */}
                <input
                    type="file"
                    multiple
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileInput}
                    accept=".pdf,.doc,.docx,image/*,video/*"
                />

                <label
                    htmlFor="file-upload"
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium cursor-pointer transition-colors shadow-sm hover:shadow"
                >
                    Browse Files
                </label>

                {/* Invisible Paste intercepter using contentEditable */}
                <div
                    className="absolute inset-0 opacity-0 outline-none z-0"
                    contentEditable
                    onPaste={handlePaste}
                    suppressContentEditableWarning
                ></div>
            </div>

            {/* Sortable List */}
            {items.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">Processing Queue ({items.length})</h3>
                        <span className="text-xs text-gray-500">Drag items to reorder them</span>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <SortableIngestionItem key={item.id} item={item} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            )}

        </div>
    );
}

// Helper generic import remapping because DND-kit exports don't always align cleanly with typical ES modules in Next
function usePointerSensor(sensor: any, options: any) { return useSensor(sensor, options); }
function useKeyboardSensor(sensor: any, options: any) { return useSensor(sensor, options); }
