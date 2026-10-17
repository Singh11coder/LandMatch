// Phase 1 stub pages: each calls a real service and demonstrates loading / empty / error states.
import { useAsync } from '../hooks/useAsync.js'
import { PageState } from '../components/common/index.jsx'
import { areaService } from '../services/areaService.js'
import { alertService } from '../services/alertService.js'
import { inspectionService } from '../services/inspectionService.js'
import { timelineService } from '../services/timelineService.js'
import { Link } from 'react-router-dom'

function Stub({ name, phase, fn, empty, render }) {
  const { data, loading, error, reload } = useAsync(fn, [])
  return (
    <PageState loading={loading} error={error} onRetry={reload} empty={Array.isArray(data) && !data.length} emptyProps={empty}>
      <div className="rounded-xl border border-line bg-surface p-6">
        <h2 className="font-semibold">{name}</h2>
        <p className="mt-1 text-sm text-muted">Full page arrives in {phase}. Service layer is live: {render(data)}</p>
      </div>
    </PageState>
  )
}
const e = (title, message) => ({ title, message })
export const Dashboard = () => <Stub name="Overview Dashboard" phase="Phase 2" fn={areaService.list} empty={e('No monitored areas', 'Add an area to begin monitoring.')} render={(d) => `${d?.length} monitored areas loaded.`} />
export const ChangeDetection = () => <Stub name="Change Detection" phase="Phase 2" fn={areaService.list} empty={e('No areas', 'Add an area first.')} render={(d) => `${d?.length} areas available for comparison.`} />
export const Alerts = () => <Stub name="Alerts & Protected Zones" phase="Phase 3" fn={() => alertService.list()} empty={e('No alerts', 'Run a comparison to generate alerts.')} render={(d) => `${d?.length} alerts, ${d?.filter((a) => a.inProtectedZone).length} inside protected zones.`} />
export const Inspections = () => <Stub name="Inspections" phase="Phase 3" fn={inspectionService.list} empty={e('No inspections', 'Nothing is assigned to you yet.')} render={(d) => `${d?.length} inspections visible to your role.`} />
export const Timeline = () => <Stub name="Historical Timeline" phase="Phase 4" fn={() => timelineService.get('area-upper-lake')} empty={e('No imagery history', 'No dates available for this area.')} render={(d) => `${d?.length} imagery dates for Upper Lake.`} />
export const NotFound = () => <div className="p-8 text-center"><p className="font-semibold">Page not found</p><Link className="text-accent underline" to="/">Back to overview</Link></div>
