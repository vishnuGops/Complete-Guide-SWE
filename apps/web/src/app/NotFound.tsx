import { Link } from 'react-router-dom';
import { Card } from '../ui/index.js';
import { PageHeader } from './PageHeader.js';

/** A URL that names nothing (P4-2; a page of its own since P9-6). */
export function NotFound() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Not found" />
      <div className="px-6 pb-6">
        <Card className="max-w-prose">
          <p className="text-sm">No such page.</p>
          <p className="text-fg-muted mt-1 text-sm">
            The address names nothing here.{' '}
            <Link to="/" className="focus-ring text-accent-fg rounded-xs underline">
              Back to the problems
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}
