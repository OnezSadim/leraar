'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Calendar,
    Clock,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Plus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface QueueItem {
    id: string;
    material_id?: string;
    test_info: string;
    status: string;
    estimated_time_seconds: number;
    created_at: string;
}

interface Schedule {
    id: string;
    scheduled_start: string;
    duration_seconds: number;
    status: string;
    queue_item: QueueItem;
}

export default function StudyQueue({ onPlan }: { onPlan: (item: QueueItem) => void }) {
    const router = useRouter()
    const supabase = createClient()
    const [queue, setQueue] = useState<QueueItem[]>([])
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchQueueData()
    }, [])

    async function fetchQueueData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: queueData } = await supabase
                .from('study_queue')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            const { data: scheduleData } = await supabase
                .from('user_schedules')
                .select(`
          *,
          queue_item:study_queue(*)
        `)
                .eq('user_id', user.id)
                .eq('status', 'upcoming')
                .order('scheduled_start', { ascending: true })

            if (queueData) setQueue(queueData)
            if (scheduleData) {
                // Sort locally to ensure correct order
                const sorted = (scheduleData as any[]).sort((a, b) =>
                    new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
                )
                setSchedules(sorted)
            }
        } catch (error) {
            console.error('Error fetching queue:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }

    if (loading) return <div className="animate-pulse h-48 bg-white/5 rounded-3xl" />

    return (
        <div className="space-y-6">
            {/* Active Schedules */}
            {schedules.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-400" />
                        Upcoming Sessions
                    </h2>
                    <div className="space-y-3">
                        {schedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                onClick={() => schedule.queue_item?.material_id && router.push(`/study/${schedule.queue_item.material_id}`)}
                                className="bg-gradient-to-r from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between group hover:border-indigo-500/40 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Clock className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold text-sm">
                                            {new Date(schedule.scheduled_start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(schedule.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </h3>
                                        <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                                            {formatDuration(schedule.duration_seconds)} • {schedule.queue_item?.test_info?.substring(0, 30)}...
                                        </p>
                                    </div>
                                </div>
                                <button className="p-2 rounded-lg bg-white/5 text-white/40 group-hover:text-white group-hover:bg-indigo-500 transition-all">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Pending Queue */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-amber-400" />
                    The Smart Queue
                </h2>
                <div className="space-y-3">
                    {queue.length === 0 && schedules.length === 0 && (
                        <div className="text-center py-12 bg-white/5 border border-white/5 rounded-3xl border-dashed">
                            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-6 w-6 text-white/20" />
                            </div>
                            <p className="text-white/40 text-xs italic font-medium">Your schedule is clear! Ready for a new challenge?</p>
                        </div>
                    )}

                    {queue.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => onPlan(item)}
                            className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-sm line-clamp-1">{item.test_info}</h3>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                                        Attention Needed • ~{formatDuration(item.estimated_time_seconds)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onPlan(item)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                            >
                                Plan Now
                            </button>
                        </div>
                    ))}

                    <button className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-2 text-white/20 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group">
                        <Plus className="h-4 w-4 group-hover:scale-125 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Import New Test / Material</span>
                    </button>
                </div>
            </section>
        </div>
    )
}
