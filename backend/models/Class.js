import mongoose from 'mongoose'

const classSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: false,
      default: 1,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

classSchema.index({ department: 1, year: 1, section: 1, semester: 1 })

export default mongoose.model('Class', classSchema)
