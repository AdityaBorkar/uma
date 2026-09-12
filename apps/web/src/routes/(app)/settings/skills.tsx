import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/settings/skills')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/settings/skills"!</div>
}
