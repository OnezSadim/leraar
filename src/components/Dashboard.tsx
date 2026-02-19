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
    Sparkles
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Subject, Material, MaterialGroup } from '@/types/database'
import StudyQueue from './StudyQueue'
import SchedulingAssistant from './SchedulingAssistant'
import { estimateQueueItemTime } from '@/lib/accountability'
import MaterialImport from './MaterialImport'
import CredentialsSettings from './CredentialsSettings'

const ICON_MAP: Record<string, any> = {
    BookOpen,
    GraduationCap,
    Atom,
    History: HistoryIcon,
    FlaskConical,
    Code2,
    Layers
}

export default function Dashboard() {
    const router = useRouter()
    const supabase = createClient()
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [materials, setMaterials] = useState<Material[]>([])
    const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
    const [loading, setLoading] = useState(true)

    const [selectedSubject, setSelectedSubject] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
    const [groupName, setGroupName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [showAssistant, setShowAssistant] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [allGroups, setAllGroups] = useState<MaterialGroup[]>([])
    const [showDiscover, setShowDiscover] = useState(false)

    useEffect(() => {
        fetchInitialData()
    }, [])

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
            m.overview.toLowerCase().includes(searchQuery.toLowerCase())
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
            alert('Failed to save group. Have you run the setup_db.sql in your Supabase SQL editor?')
        } finally {
            setIsSaving(false)
        }
    }

    const importDemoTest = async () => {
        setIsImporting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const demoText = "Physics Midterm on Friday covering Newtonian Mechanics and Thermodynamics."

            const { data: queueItem, error } = await supabase
                .from('study_queue')
                .insert({
                    user_id: user.id,
                    test_info: demoText,
                    estimated_time_seconds: 7200, // 2 hours
                    status: 'pending'
                })
                .select()
                .single()

            if (error) throw error

            setShowAssistant(true)
            window.location.reload()

        } catch (error) {
            console.error('Error importing demo test:', error)
        } finally {
            setIsImporting(false)
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
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Subject Filter Menu */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Filter className="h-5 w-5 text-indigo-300" />
                        Explore Subjects
                    </h2>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="h-4 w-4" />
                        Import Material
                    </button>
                </div>

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

                    {subjects.map((subject) => {
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

                            return (
                                <div
                                    key={material.id}
                                    onClick={() => toggleMaterialSelection(material.id)}
                                    className={`
                    group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col
                    ${isSelected
                                            ? 'bg-indigo-500/20 border-indigo-400 select-none'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}
                  `}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-gradient-to-r ${subject?.color || 'from-slate-500 to-slate-600'} text-white`}>
                                            {subject?.name || 'Subject'}
                                        </span>
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
                                        <span className="text-[10px] text-white/30 font-medium">Contains Practice Questions</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/study/${material.id}`);
                                            }}
                                            className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
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

                {/* Right Column: Credentials, Group Builder & Groups List */}
                <div className="space-y-8">
                    <CredentialsSettings />

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

                {/* Study Queue Section */}
                <div className="mt-12 bg-white/5 rounded-3xl p-8 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                                        <ClipboardList className="h-6 w-6 text-white" />
                                    </div>
                                    Your Learning Accountability
                                </h2>
                                <p className="text-white/40 text-sm mt-1 font-medium italic">"Keeping you on track with upcoming tests and focus areas."</p>
                            </div>
                            <button
                                onClick={importDemoTest}
                                disabled={isImporting}
                                className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-[1.02] shadow-xl active:scale-95 disabled:opacity-50"
                            >
                                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 text-indigo-400" />}
                                Demo: Import Test Info
                            </button>
                        </div>
                        <StudyQueue onPlan={() => setShowAssistant(true)} />
                    </div>
                </div>
            </div>

            {
                showAssistant && (
                    <SchedulingAssistant onClose={() => setShowAssistant(false)} />
                )
            }

            {
                showImportModal && (
                    <MaterialImport
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => fetchInitialData()}
                    />
                )
            }
        </div >
    )
}
