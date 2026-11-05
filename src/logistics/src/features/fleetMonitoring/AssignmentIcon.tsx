import { LuPackageCheck, LuPackageOpen, LuTruck, LuWarehouse } from 'react-icons/lu'
import type { AssignmentStage } from './assignmentTypes'

export function AssignmentIcon({ stage, hub = false }: { stage: AssignmentStage; hub?: boolean }) {
  const Icon = hub ? LuWarehouse : stage === 'first_mile' ? LuPackageOpen : stage === 'linehaul' ? LuTruck : LuPackageCheck
  return <Icon aria-hidden="true" className="size-5 shrink-0" />
}
