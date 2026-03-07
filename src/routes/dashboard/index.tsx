import { ConnectionBanner } from '@/components/connection-banner'
import { FilesTable } from '@/components/files-table'
import { PageLoading } from '@/components/page-loading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isDocketwiseConnected, isDropboxConnected } from '@/lib/auth-tokens'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Activity, FileText, Loader2, Package } from 'lucide-react'

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [totalFiles, inQueue, processedToday, fileTypes, docketwise, dropbox] =
    await Promise.all([
      prisma.scanJobs.count(),
      prisma.scanJobs.count({
        where: { status: { in: ['pending', 'processing'] } },
      }),
      prisma.scanJobs.count({
        where: { status: 'completed', updatedAt: { gte: startOfDay } },
      }),
      prisma.scanJobs
        .groupBy({ by: ['mimeType'], _count: true })
        .then((r) => r.length),
      isDocketwiseConnected(),
      isDropboxConnected(),
    ])

  return { totalFiles, inQueue, processedToday, fileTypes, docketwise, dropbox }
})

export const Route = createFileRoute('/dashboard/')({
  component: DashboardPage,
  pendingComponent: PageLoading,
  loader: () => getDashboardData(),
})

function DashboardPage() {
  const data = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <ConnectionBanner
        dropboxConnected={data.dropbox}
        docketwiseConnected={data.docketwise}
      />

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your document management system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalFiles}</div>
            <p className="text-xs text-muted-foreground">All uploaded files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Types</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.fileTypes}</div>
            <p className="text-xs text-muted-foreground">Different formats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.inQueue}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Processed Today
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.processedToday}</div>
            <p className="text-xs text-muted-foreground">Completed today</p>
          </CardContent>
        </Card>
      </div>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Files</CardTitle>
        </CardHeader>
        <CardContent>
          <FilesTable />
        </CardContent>
      </Card>
    </div>
  )
}
