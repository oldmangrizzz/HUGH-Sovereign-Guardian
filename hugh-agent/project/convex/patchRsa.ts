import { mutation } from "./_generated/server";
export default mutation({
  handler: async (ctx) => {
    const state = await ctx.db.query("endocrineState").withIndex("by_node", q=>q.eq("nodeId", "hugh-primary")).unique();
    if (state) {
      await ctx.db.patch(state._id, {
        respiratoryPhase: "exhale",
        co2Pressure: 0.1,
        breathHoldDuration: 0,
      });
      console.log("Patched RSA fields on existing state.");
    }
  }
});