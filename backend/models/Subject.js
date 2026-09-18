import mongoose from 'mongoose'

const subjectSchema = new mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    subjectName: {
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
    active: {
      type: Boolean,
      default: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: false,
    },
  },
  { timestamps: true },
)

subjectSchema.index({ subjectCode: 1 })
subjectSchema.index({ classId: 1 })

export default mongoose.model('Subject', subjectSchema)
