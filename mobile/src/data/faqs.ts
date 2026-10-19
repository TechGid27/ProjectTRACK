import { FaqItem } from '../core/types';

export const FAQS: FaqItem[] = [
  {
    q: 'What data does ProjectTRACK show?',
    a: 'ProjectTRACK loads DPWH public-works projects for Cebu Province from a Neo4j database — including project ID, description, location, contractor, budget, and status (ongoing or completed with completion percentage).',
  },
  {
    q: 'How do I find projects in my municipality?',
    a: 'Click the municipality polygon on the map, or use the Location Intel panel on the left. You can also use the chat assistant in the bottom-right corner to ask questions like "List ongoing projects in Toledo City."',
  },
  {
    q: 'What do the map pin colors mean?',
    a: 'Teal diamonds mark ongoing projects and blue diamonds mark completed projects. When multiple projects share the same coordinate, one pin is drawn — click it to open the full list.',
  },
  {
    q: 'How current is the data?',
    a: 'The project dataset is imported from DPWH published project records. Status percentages reflect the latest recorded progress for each project.',
  },
  {
    q: 'Can I report an incorrect or anomalous entry?',
    a: 'Yes. Open any project’s details from the map and use the Report Anomaly button to flag issues such as wrong budgets, stale statuses, or incorrect locations.',
  },
];
