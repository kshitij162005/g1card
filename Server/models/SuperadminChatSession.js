import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: { type: [Object], default: [] },
    // Which provider/model wrote an assistant message
    model: { type: Object, default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SuperadminChatSessionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Superadmin', required: true },
    title: { type: String, required: true },
    messages: { type: [ChatMessageSchema], default: [] },
    // Model chosen when the chat started ({ provider, model? }); null = Auto. Fixed for the whole chat.
    preference: { type: Object, default: null },
  },
  { timestamps: true }
);

SuperadminChatSessionSchema.index({ adminId: 1, updatedAt: -1 });

export default mongoose.model('SuperadminChatSession', SuperadminChatSessionSchema);
