'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    BookOpen,
    Search,
    Filter,
    Plus,
    X,
    Check,
    ChevronRight,
    Layers,
    GraduationCap,
    Atom,
    History as HistoryIcon,
    FlaskConical,
    Code2,
    Trash2,
    Save,
    FolderPlus,
    Loader2,
    PlayCircle,
    ClipboardList,
    Sparkles,
    Languages,
    Scroll,
    Landmark,
    Calculator,
    Variable,
    Divide,
    Pi,
    Leaf,
    TrendingUp,
    Briefcase,
    Globe,
    Users,
    Brain,
    Palette,
    Music,
    Microscope,
    GitFork
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Subject, Material, MaterialGroup } from '@/types/database'
import StudyQueue from './StudyQueue'
import SchedulingAssistant from './SchedulingAssistant'
import { estimateQueueItemTime } from '@/lib/accountability'
import { searchGlobalMaterials, importMaterialToUser } from '@/lib/actions/material-actions'
import MaterialImport from './MaterialImport'
import CalendarPlugin from './CalendarPlugin'

const ICON_MAP: Record<string, any> = {
    BookOpen,
    GraduationCap,
    Atom,
    History: HistoryIcon,
    FlaskConical,
    Code2,
    Layers,
    Languages,
    Scroll,
    Landmark,
    Calculator,
    Variable,
    Divide,
    Pi,
    Leaf,
    TrendingUp,
    Briefcase,
    Globe2: Globe,
    Users,
    Brain,
    Palette,
    Music,
    Microscope
}

export default function Dashboard() {
    const router = useRouter()
    const supabase = createClient()
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [materials, setMaterials] = useState<Material[]>([])
    const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    const [selectedSubject, setSelectedSubject] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [globalResults, setGlobalResults] = useState<{ materials: any[], groups: any[] } | null>(null)
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
    const [groupName, setGroupName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [showAssistant, setShowAssistant] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [allGroups, setAllGroups] = useState<MaterialGroup[]>([])
    const [showDiscover, setShowDiscover] = useState(false)
    const [subjectSearch, setSubjectSearch] = useState('')

    useEffect(() => {
        fetchInitialData()
    }, [])

    async function handleSearch(query: string) {
        setSearchQuery(query)
        if (query.trim().length > 2) {
            setIsSearching(true)
            const results = await searchGlobalMaterials(query)
            setGlobalResults(results)
            setIsSearching(false)
        } else {
            setGlobalResults(null)
        }
    }

    async function handleImport(materialId: string, groupId?: string) {
        try {
            await importMaterialToUser(materialId, groupId)
            await fetchInitialData() // Refresh library
            setGlobalResults(null)
            setSearchQuery('')
        } catch (error) {
            console.error("Error importing material:", error)
        }
    }

    async function fetchInitialData() {
        setLoading(true)
        try {
            // Fetch subjects
            const { data: subjectsData } = await supabase.from('subjects').select('*')

            // Fetch materials
            const { data: materialsData } = await supabase.from('materials').select('*')

            // Fetch user groups
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setCurrentUserId(user.id)
                const { data: groupsData } = await supabase
                    .from('material_groups')
                    .select(`
            *,
            materials:material_group_items(
              material:materials(*)
            )
          `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })

                if (groupsData) {
                    const formattedGroups = groupsData.map(group => ({
                        ...group,
                        materials: group.materials.map((m: any) => m.material)
                    }))
                    setMaterialGroups(formattedGroups)
                }
            }

            if (subjectsData) setSubjects(subjectsData)
            if (materialsData) setMaterials(materialsData)

            // Fetch all public groups for discovery
            const { data: allGroupsData } = await supabase
                .from('material_groups')
                .select('*')
                .limit(10)
            if (allGroupsData) setAllGroups(allGroupsData)

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const joinGroup = async (groupId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('group_subscriptions')
                .insert({ user_id: user.id, group_id: groupId })

            if (error) {
                if (error.code === '23505') alert('You are already subscribed to this group!')
                else throw error
            } else {
                alert('Successfully joined group!')
                fetchInitialData()
            }
        } catch (error) {
            console.error('Error joining group:', error)
        }
    }

    const filteredMaterials = materials.filter(m => {
        const matchesSubject = selectedSubject === 'all' || m.subject_id === selectedSubject
        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.overview ?? m.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        return matchesSubject && matchesSearch
    })

    const toggleMaterialSelection = (id: string) => {
        if (selectedMaterials.includes(id)) {
            setSelectedMaterials(selectedMaterials.filter(mid => mid !== id))
        } else {
            setSelectedMaterials([...selectedMaterials, id])
        }
    }

    const createGroup = async () => {
        if (!groupName || selectedMaterials.length === 0) return
        setIsSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not found')

            // 1. Create the group
            const { data: group, error: groupError } = await supabase
                .from('material_groups')
                .insert({ name: groupName, user_id: user.id })
                .select()
                .single()

            if (groupError) throw groupError

            // 2. Add materials to the group
            const items = selectedMaterials.map(mid => ({
                group_id: group.id,
                material_id: mid
            }))

            const { error: itemsError } = await supabase
                .from('material_group_items')
                .insert(items)

            if (itemsError) throw itemsError

            // 3. Update local state
            const newGroupWithMaterials: MaterialGroup = {
                ...group,
                materials: materials.filter(m => selectedMaterials.includes(m.id))
            }

            setMaterialGroups([newGroupWithMaterials, ...materialGroups])
            setGroupName('')
            setSelectedMaterials([])

        } catch (error) {
            console.error('Error creating group:', error)
            alert('Failed to save group. Please ensure the database is properly initialized.')
        } finally {
            setIsSaving(false)
        }
    }


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                <p className="text-white/40 font-medium">Preparing your study material...</p>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* Learning Accountability Section (Top & Wide) */}
            <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 border border-white/10 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-[100px] group-hover:bg-indigo-500/15 transition-all duration-700 font-bold" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 rounded-full -ml-32 -mb-32 blur-[80px]" />

                <div className="relative">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                        <div>
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-3 bg-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-500/10 scale-110">
                                    <ClipboardList className="h-6 w-6 text-white" />
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tight">
                                    Accountability <span className="text-indigo-400">Agent</span>
                                </h2>
                            </div>
                            <p className="text-white/40 text-sm font-medium italic pl-1">
                                "Your personalized study guide, ensuring you never miss a milestone."
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => setShowAssistant(true)}
                                className="flex items-center gap-3 px-8 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <Sparkles className="h-4 w-4" />
                                Optimize Schedule
                            </button>
                        </div>
                    </div>

                    <div className="bg-black/20 rounded-[2rem] p-6 border border-white/5">
                        <StudyQueue onPlan={() => setShowAssistant(true)} />
                    </div>
                </div>
            </div>

            {/* Subject Filter Menu */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            <Filter className="h-6 w-6 text-indigo-400" />
                            Knowledge <span className="text-white/40 font-bold">Library</span>
                        </h2>
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20 mt-1">Filter by subject area or search globally</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group/subj-search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 group-focus-within/subj-search:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                value={subjectSearch}
                                onChange={(e) => setSubjectSearch(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-white/20 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
                            />
                        </div>
                        <div className="hidden md:flex relative group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within/search:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search all materials..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white placeholder:text-white/20 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 animate-spin" />
                            )}
                        </div>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-3 px-8 py-3.5 bg-white/5 border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 group/import"
                        >
                            <Plus className="h-4 w-4 text-indigo-500 group-hover:scale-125 transition-transform" />
                            Import Material
                        </button>
                    </div>
                </div>

                {/* Global Search Results */}
                {globalResults && (
                    <div className="mb-12 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Discovered Online
                            </h3>
                            <button onClick={() => setGlobalResults(null)} className="text-white/20 hover:text-white transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {globalResults.materials.map((res: any) => (
                                <div key={res.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-indigo-500/30 transition-all group overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleImport(res.id)}
                                            className="p-3 bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-110 active:scale-95 transition-all"
                                            title="Add to Library"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-400 shadow-inner`}>
                                            <BookOpen className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold leading-tight line-clamp-2 pr-8">{res.title}</h4>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400/60 mt-2 block">
                                                {res.subjects?.name || 'Shared Content'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-white/40 text-xs font-medium line-clamp-3 mb-4 leading-relaxed italic">
                                        "{res.overview}"
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="h-px bg-white/5 mt-12 mb-8 w-full" />
                    </div>
                )}

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    <button
                        onClick={() => setSelectedSubject('all')}
                        className={`
              flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 min-w-[120px]
              ${selectedSubject === 'all'
                                ? 'bg-white/20 border-white/40 shadow-lg scale-105'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'}
            `}
                    >
                        <div className={`p-3 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-md`}>
                            <BookOpen className="h-6 w-6 text-white" />
                        </div>
                        <span className={`text-sm font-medium ${selectedSubject === 'all' ? 'text-white' : 'text-white/70'}`}>
                            All Subjects
                        </span>
                    </button>

                    {subjects
                        .filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                        .map((subject) => {
                            const Icon = ICON_MAP[subject.icon] || BookOpen
                            const isActive = selectedSubject === subject.id
                            return (
                                <button
                                    key={subject.id}
                                    onClick={() => setSelectedSubject(subject.id)}
                                    className={`
                  flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 min-w-[120px]
                  ${isActive
                                            ? 'bg-white/20 border-white/40 shadow-lg scale-105'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-102'}
                `}
                                >
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${subject.color} shadow-md`}>
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                                        {subject.name}
                                    </span>
                                    {isActive && <div className="h-1 w-8 bg-white rounded-full mt-1" />}
                                </button>
                            )
                        })}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Materials List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-indigo-300" />
                            Available Material
                        </h2>
                        <span className="text-sm text-white/50">{filteredMaterials.length} items found</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredMaterials.map((material) => {
                            const subject = subjects.find(s => s.id === material.subject_id)
                            const isSelected = selectedMaterials.includes(material.id)
                            const isFork = !!material.original_material_id

                            return (
                                <div
                                    key={material.id}
                                    onClick={() => toggleMaterialSelection(material.id)}
                                    className={`
                    group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col
                    ${isSelected
                                            ? 'bg-indigo-500/20 border-indigo-400 select-none'
                                            : isFork
                                                ? 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10 hover:border-teal-500/40'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}
                  `}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-gradient-to-r ${subject?.color || 'from-slate-500 to-slate-600'} text-white`}>
                                                {subject?.name || 'Subject'}
                                            </span>
                                            {isFork && (
                                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                                                    <GitFork className="h-2.5 w-2.5" />
                                                    Remixed
                                                </span>
                                            )}
                                        </div>
                                        {isSelected ? (
                                            <div className="bg-indigo-500 rounded-full p-1 ring-4 ring-indigo-500/20">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        ) : (
                                            <div className="bg-white/5 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Plus className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-white font-semibold mb-1">{material.title}</h3>
                                    <p className="text-white/50 text-xs line-clamp-2 leading-relaxed mb-4">
                                        {material.overview}
                                    </p>

                                    <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/discover/${material.id}`);
                                            }}
                                            className="flex items-center gap-1.5 text-[10px] text-white/50 hover:text-white transition-colors uppercase tracking-widest font-bold"
                                        >
                                            <BookOpen className="h-3 w-3" />
                                            Details & Comments
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/study/${material.id}`);
                                            }}
                                            className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors uppercase tracking-widest"
                                        >
                                            <PlayCircle className="h-3 w-3" />
                                            Start Learning
                                        </button>
                                    </div>

                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right Column: Group Builder & Groups List */}
                <div className="space-y-8">
                    {currentUserId && (
                        <div className="h-[400px]">
                            <CalendarPlugin userId={currentUserId} />
                        </div>
                    )}

                    <section className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <FolderPlus className="h-5 w-5 text-indigo-300" />
                            Create Study Group
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Group Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Midterms Phase 1"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Selected Materials</label>
                                    <span className="text-[10px] text-indigo-300 font-bold">{selectedMaterials.length} selected</span>
                                </div>

                                <div className="min-h-[100px] border-2 border-dashed border-white/10 rounded-xl p-3 flex flex-wrap gap-2 items-start bg-black/20">
                                    {selectedMaterials.length === 0 ? (
                                        <p className="text-white/20 text-xs italic text-center w-full mt-8">Select materials from the list to add them here</p>
                                    ) : (
                                        selectedMaterials.map(mid => {
                                            const material = materials.find(m => m.id === mid)
                                            return (
                                                <div key={mid} className="bg-white/10 border border-white/10 rounded-lg py-1.5 px-3 flex items-center gap-2 group/tag animate-in zoom-in duration-300">
                                                    <span className="text-xs text-white truncate max-w-[120px]">{material?.title}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleMaterialSelection(mid)
                                                        }}
                                                        className="hover:text-red-400 text-white/40 transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={createGroup}
                                disabled={!groupName || selectedMaterials.length === 0 || isSaving}
                                className={`
                  w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 shadow-lg flex items-center justify-center gap-2
                  ${groupName && selectedMaterials.length > 0 && !isSaving
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-95'
                                        : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'}
                `}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {isSaving ? 'Saving...' : 'Build Material Group'}
                            </button>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Layers className="h-5 w-5 text-indigo-300" />
                                {showDiscover ? 'Discover Groups' : 'Saved Groups'}
                            </h2>
                            <button
                                onClick={() => setShowDiscover(!showDiscover)}
                                className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                            >
                                {showDiscover ? 'View My Groups' : 'Find More'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {showDiscover ? (
                                allGroups.filter(g => !materialGroups.find(mg => mg.id === g.id)).map((group) => (
                                    <div
                                        key={group.id}
                                        className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <Layers className="h-6 w-6 text-indigo-300/40" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-medium">{group.name}</h3>
                                                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Public Group</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => joinGroup(group.id)}
                                            className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-lg text-xs font-bold transition-all"
                                        >
                                            Join
                                        </button>
                                    </div>
                                ))
                            ) : (
                                materialGroups.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => router.push(`/study/${group.id}`)}
                                        className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <Layers className="h-6 w-6 text-indigo-300" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-medium">{group.name}</h3>
                                                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">
                                                    {group.materials?.length || 0} Materials • {group.materials?.map(m => subjects.find(s => s.id === m.subject_id)?.name).filter((v, i, a) => a && v && a.indexOf(v) === i).join(', ') || 'Mixed'}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))
                            )}

                            {!showDiscover && materialGroups.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-2xl">
                                    <p className="text-white/20 text-sm italic">No study groups created yet.</p>
                                </div>
                            )}

                            {showDiscover && allGroups.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-2xl">
                                    <p className="text-white/20 text-sm italic">No public groups found.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {showAssistant && (
                <SchedulingAssistant onClose={() => setShowAssistant(false)} />
            )}

            {showImportModal && (
                <MaterialImport
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => fetchInitialData()}
                />
            )}
        </div>
    )
}
