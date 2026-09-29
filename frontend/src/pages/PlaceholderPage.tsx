import { Badge, Card } from '@/components/ui'
import { PageHeader } from '@/components/layout'

export interface PlaceholderPageProps {
  title: string
  description: string
  /** Which sprint delivers this screen, shown rather than implied. */
  plannedIn: string
}

/**
 * A screen that exists in the navigation but has not been built yet.
 *
 * It states that plainly instead of faking a plausible-looking empty dashboard.
 * A stub that renders three meaningless zero-valued metrics teaches an evaluator
 * that the product fabricates evidence, which is the one thing this project must
 * never do — see PRODUCT.md § Evidence on Hand.
 */
export function PlaceholderPage({ title, description, plannedIn }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />

      <Card>
        <div className="flex flex-col items-start gap-3">
          <Badge tone="neutral">{plannedIn}</Badge>
          <p className="max-w-prose text-sm text-secondary">
            Esta pantalla se construye en un sprint posterior. Lo que se ve ahora es el armazón de
            la consola, no un estado vacío de esta pantalla: no hay datos que mostrar todavía y no
            se está fingiendo que los haya.
          </p>
        </div>
      </Card>
    </>
  )
}
