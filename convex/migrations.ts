import { mutation } from "./_generated/server";

/**
 * Remove deprecated `status` and `progressScore` fields from all projects.
 *
 * Run after deploy:
 *   npx convex run migrations:removeStatusField
 *
 * Once complete, remove the optional `status` and `progressScore` fields
 * from the projects table in schema.ts, then deploy again.
 */
export const removeStatusField = mutation({
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let migrated = 0;

    for (const project of projects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = project as any;
      if (doc.status !== undefined || doc.progressScore !== undefined) {
        const {
          _id,
          _creationTime,
          status: _status,
          progressScore: _progressScore,
          ...fields
        } = doc;
        await ctx.db.replace(_id, fields);
        migrated++;
      }
    }

    console.log(
      `Migration complete: ${migrated}/${projects.length} projects updated`
    );
    return { migrated, total: projects.length };
  },
});
