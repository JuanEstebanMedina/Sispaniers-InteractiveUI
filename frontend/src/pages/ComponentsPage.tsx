import { Download, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ApiError } from '@/api/errors'
import { Avatar, AvatarGroup } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Field } from '@/components/ui/Field'
import { Input, SearchInput, Select, Textarea } from '@/components/ui/Input'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton, SkeletonTable, Spinner } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/charts/StatCard'
import { HealthChip, OperationStatusBadge } from '@/components/operations/OperationStatus'
import { DataTable, columnHelperFor } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { Checkbox, Switch } from '@/components/ui/Toggle'
import { useDisclosure } from '@/hooks'
import { LOCALE_LABELS, SUPPORTED_LOCALES, currentLocale, setLocale } from '@/i18n'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import { useThemeStore } from '@/stores/themeStore'

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-12">
      <div className="mb-4 border-b border-line pb-2">
        <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="min-w-0">
      <div className={cn('h-12 rounded-md border border-line', className)} />
      <p className="mt-0.5 truncate text-2xs text-fg-muted">{name}</p>
    </div>
  )
}

interface DemoRow {
  id: string
  trackId: string
  shipper: string
  containers: number
  status: string
}

const demoColumn = columnHelperFor<DemoRow>()

const DEMO_ROWS: DemoRow[] = [
  { id: '1', trackId: 'TRK-4400', shipper: 'Muebles del Sur', containers: 4, status: 'in_transit' },
  { id: '2', trackId: 'op-andes-002', shipper: 'Andes Textiles', containers: 2, status: 'customs' },
  { id: '3', trackId: 'TRK-4402', shipper: 'Café de Origen Ltda.', containers: 1, status: 'in_orbit' },
]

export default function ComponentsPage() {
  const { resolved, toggleTheme } = useThemeStore()
  const modal = useDisclosure()
  const confirm = useDisclosure()
  const [tab, setTab] = useState('buttons')
  const [page, setPage] = useState(3)
  const [confirming, setConfirming] = useState(false)
  const locale = currentLocale()

  const demoColumns = useMemo(
    () => [
      demoColumn.accessor('trackId', { header: 'Track Id', meta: { primary: true } }),
      demoColumn.accessor('shipper', { header: 'Shipper' }),
      demoColumn.accessor('containers', { header: 'Containers', meta: { numeric: true } }),
      demoColumn.accessor('status', {
        header: 'Status',
        cell: ({ getValue }) => <OperationStatusBadge status={getValue()} />,
      }),
    ],
    [],
  )

  return (
    <PageContainer>
      <PageHeader
        title="Component catalogue"
        description="Everything the system provides. Switch theme and language above to verify every combination."
        meta={<Badge tone="warning">Development only</Badge>}
        actions={
          <Button variant="secondary" onClick={toggleTheme}>
            Theme: {resolved}
          </Button>
        }
      />

      <Card className="mb-8">
        <CardBody className="space-y-3">
          <Row>
            <span className="w-20 text-sm text-fg-muted">Locale</span>
            {SUPPORTED_LOCALES.map((code) => (
              <Button
                key={code}
                size="sm"
                variant={locale === code ? 'primary' : 'outline'}
                onClick={() => setLocale(code)}
              >
                {LOCALE_LABELS[code]}
              </Button>
            ))}
          </Row>
        </CardBody>
      </Card>

      <Section
        title="Semantic tokens"
        hint="No component writes a raw colour. These are the ones in use, and the ones that change with the theme."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          <Swatch name="canvas" className="bg-canvas" />
          <Swatch name="surface" className="bg-surface" />
          <Swatch name="surface-sunken" className="bg-surface-sunken" />
          <Swatch name="surface-hover" className="bg-surface-hover" />
          <Swatch name="brand" className="bg-brand" />
          <Swatch name="brand-subtle" className="bg-brand-subtle" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="accent-subtle" className="bg-accent-subtle" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="danger" className="bg-danger" />
          <Swatch name="info" className="bg-info" />
          <Swatch name="line" className="bg-line" />
          <Swatch name="line-strong" className="bg-line-strong" />
          <Swatch name="fg-muted" className="bg-fg-muted" />
          <Swatch name="fg" className="bg-fg" />
        </div>

        <p className="mb-3 mt-6 text-sm text-fg-muted">
          Chart series — fixed order, validated for colour blindness in both themes:
        </p>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <Swatch key={index} name={`chart-${index + 1}`} className={`bg-chart-${index + 1}`} />
          ))}
        </div>
      </Section>

      <Section title="Typography" hint="Scale in rem, ratio ~1.2. Numbers are tabular.">
        <div className="space-y-2">
          <p className="font-display text-5xl">Aa · 4rem · display</p>
          <p className="font-display text-3xl">Aa · 2.25rem · display</p>
          <p className="text-xl">Aa · 1.375rem · page title</p>
          <p className="text-lg">Aa · 1.125rem · card title</p>
          <p className="text-md">Aa · 1rem · reading text</p>
          <p className="text-base">Aa · 0.875rem · UI base</p>
          <p className="text-sm text-fg-muted">Aa · 0.8125rem · table</p>
          <p className="text-xs text-fg-subtle">Aa · 0.75rem · metadata</p>
          <p className="data-mono mt-4">pay_01HQ8FZX · $ 12.480,50 · NAU-2287-XK</p>
        </div>
      </Section>

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'buttons', label: 'Buttons' },
          { value: 'forms', label: 'Forms' },
          { value: 'data', label: 'Data', count: 4 },
          { value: 'states', label: 'States' },
        ]}
      />

      {tab === 'buttons' && (
        <>
          <Section title="Variants">
            <Row>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="soft">Soft</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="link">Link</Button>
            </Row>
          </Section>

          <Section title="Sizes and states" hint="All align with the inputs: same height scale.">
            <Row>
              <Button size="xs">XS</Button>
              <Button size="sm">SM</Button>
              <Button size="md">MD</Button>
              <Button size="lg">LG</Button>
              <Button size="icon" aria-label="Add">
                <Plus />
              </Button>
            </Row>
            <div className="mt-3">
              <Row>
                <Button icon={<Plus />}>With icon</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button variant="danger" icon={<Trash2 />} onClick={confirm.open}>
                  With confirmation
                </Button>
              </Row>
            </div>
          </Section>

          <Section title="Avatars">
            <Row>
              <Avatar name="Valentina Torres" size="xs" />
              <Avatar name="Andrés Restrepo" size="sm" status="online" />
              <Avatar name="Camila Ríos" size="md" />
              <Avatar name="Diego Marín" size="lg" status="busy" />
              <AvatarGroup
                people={[
                  { name: 'Valentina Torres' },
                  { name: 'Andrés Restrepo' },
                  { name: 'Camila Ríos' },
                  { name: 'Diego Marín' },
                  { name: 'Sofía Pérez' },
                  { name: 'Luis Hernández' },
                ]}
              />
            </Row>
          </Section>
        </>
      )}

      {tab === 'forms' && (
        <Section title="Controls" hint="Field wires label, error and aria-* automatically.">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Email" description="Used to sign in." required>
              <Input type="email" placeholder="you@company.com" />
            </Field>

            <Field label="Password" error="Password must be at least 8 characters" required>
              <Input type="password" defaultValue="123" />
            </Field>

            <Field label="Status">
              <Select
                placeholder="All"
                options={[
                  { value: 'captured', label: 'Captured' },
                  { value: 'failed', label: 'Declined' },
                  { value: 'chargeback', label: 'Chargeback' },
                ]}
              />
            </Field>

            <Field label="Search">
              <SearchInput placeholder="Reference, customer, id…" />
            </Field>

            <Field label="Amount" hint="COP" className="sm:col-span-2">
              <Input type="number" inputMode="decimal" leading="$" trailing="COP" placeholder="0" />
            </Field>

            <Field label="Notes" description="Stored in the history." className="sm:col-span-2">
              <Textarea autoResize placeholder="Write something…" />
            </Field>

            <div className="space-y-3 sm:col-span-2">
              <Checkbox label="I accept the terms" description="Required to continue." />
              <Checkbox label="Partial selection" indeterminate />
              <Switch label="Email notifications" description="Takes effect immediately." />
            </div>

            <div className="sm:col-span-2">
              <Row>
                <Button onClick={() => toast.success('Saved successfully')}>Success toast</Button>
                <Button variant="secondary" onClick={() => toast.warning('Check the data')}>
                  Warning
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.apiError(
                      new ApiError({ kind: 'server', status: 500, traceId: 'req_a3f9c2' }),
                    )
                  }
                >
                  API error
                </Button>
                <Button variant="ghost" onClick={modal.open}>
                  Open modal
                </Button>
              </Row>
            </div>
          </div>
        </Section>
      )}

      {tab === 'data' && (
        <>
          <Section
            title="Operation status"
            hint="Two axes: status answers «where is it?», health answers «is it going well?». An unknown status falls back to neutral instead of breaking."
          >
            <Row>
              {[
                'booking_confirmed',
                'arrived_port',
                'in_transit',
                'customs',
                'delivered',
                'exception',
                'weird_backend_state',
              ].map((status) => (
                <OperationStatusBadge key={status} status={status} />
              ))}
            </Row>
            <div className="mt-3">
              <Row>
                {['on_track', 'at_risk', 'critical'].map((health) => (
                  <HealthChip key={health} health={health} />
                ))}
              </Row>
            </div>
          </Section>

          <Section title="Table" hint="TanStack Table v9 in server mode. The third row has an unknown status.">
            <Card>
              <DataTable columns={demoColumns} rows={DEMO_ROWS} getRowId={(row) => row.id} />
            </Card>
          </Section>

          <Section title="KPIs" hint="`invertDelta` when going up is bad (chargebacks, errors).">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Volume"
                value="$ 48.2 M"
                delta={0.124}
                deltaLabel="vs. previous month"
                trend={[12, 18, 15, 24, 22, 31, 28, 36]}
                colorIndex={0}
              />
              <StatCard
                label="Approval"
                value="94.2 %"
                delta={0.042}
                deltaLabel="vs. previous month"
                colorIndex={7}
              />
              <StatCard
                label="Chargebacks"
                value="0.84 %"
                delta={0.019}
                deltaLabel="vs. previous month"
                invertDelta
                colorIndex={5}
              />
              <StatCard label="Loading" value="—" isLoading />
            </div>
          </Section>

          <Section title="Pagination">
            <Card>
              <Pagination
                page={page}
                pageSize={20}
                total={1482}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
              />
            </Card>
          </Section>
        </>
      )}

      {tab === 'states' && (
        <>
          <Section title="Loading" hint="The skeleton has the shape of the content that is coming.">
            <Card>
              <SkeletonTable rows={3} columns={5} />
            </Card>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-64" />
              <Spinner label="Loading…" />
            </div>
          </Section>

          <Section title="Empty" hint="«No data» and «no results» are different problems.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <EmptyState variant="empty" action={<Button size="sm">Create the first</Button>} />
              </Card>
              <Card>
                <EmptyState
                  variant="no-results"
                  action={
                    <Button size="sm" variant="secondary">
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            </div>
          </Section>

          <Section title="Error" hint="The 403 offers no retry; the network error does.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <ErrorState
                  error={new ApiError({ kind: 'network' })}
                  onRetry={() => toast.info('Retrying…')}
                />
              </Card>
              <Card>
                <ErrorState
                  error={
                    new ApiError({ kind: 'forbidden', status: 403, traceId: 'req_7f2a91' })
                  }
                  onRetry={() => toast.info('This should not appear')}
                  action={
                    <Button size="sm" variant="ghost">
                      Back
                    </Button>
                  }
                />
              </Card>
            </div>
          </Section>
        </>
      )}

      <Modal
        open={modal.isOpen}
        onClose={modal.close}
        title="Transaction detail"
        description="Built on the native <dialog>: focus trap and Escape for free."
        footer={
          <>
            <Button variant="ghost" onClick={modal.close}>
              Close
            </Button>
            <Button icon={<Download />}>Download receipt</Button>
          </>
        }
      >
        <div className="space-y-3 text-base text-fg-muted">
          <p>
            Try <kbd className="rounded-xs border border-line px-0.5 text-xs">Tab</kbd>: focus
            cannot escape to the background. Try{' '}
            <kbd className="rounded-xs border border-line px-0.5 text-xs">Esc</kbd>: it closes.
          </p>
          <p className="data-mono text-sm">pay_01HQ8FZX9K2M4N6P8R</p>
        </div>
      </Modal>

      <ConfirmModal
        open={confirm.isOpen}
        onClose={confirm.close}
        loading={confirming}
        title="Issue the refund?"
        message="$ 128,400 COP will be returned to the customer. This cannot be undone."
        confirmLabel="Yes, refund"
        onConfirm={async () => {
          setConfirming(true)
          await new Promise((resolve) => setTimeout(resolve, 1200))
          setConfirming(false)
          confirm.close()
          toast.success('Decision recorded')
        }}
      />
    </PageContainer>
  )
}
