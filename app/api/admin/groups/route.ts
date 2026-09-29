import { adminRoute, readJson } from '@/lib/api';
import { generateSchedule } from '@/lib/tournament';
import type { GroupAssignment } from '@/lib/types';

export const POST = adminRoute(async (req) => {
  const { assignment } = await readJson<{ assignment: GroupAssignment }>(req);
  generateSchedule(assignment);
});
