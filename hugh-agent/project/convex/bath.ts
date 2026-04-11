import { mutation } from "./_generated/server";
export default mutation({
  handler: async (ctx) => {
    const state = await ctx.db.query("endocrineState").withIndex("by_node", q=>q.eq("nodeId", "hugh-primary")).unique();
    if (state) {
      await ctx.db.patch(state._id, {
        cortisol: 0.1,
        adrenaline: 0.05,
        dopamine: 0.3,
        serotonin: 0.85,
        oxytocin: 0.7,
        vagalTone: 0.95,
        fatigue: 0.05
      });
      console.log("Warm bath administered. Vagal tone maximized.");
    }
  }
});
