import mongoose from 'mongoose'

const timetableSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      trim: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

timetableSchema.index({ classId: 1, day: 1, period: 1 }, { unique: true })

timetableSchema.index({ teacherId: 1, day: 1, period: 1 })

export default mongoose.model('Timetable', timetableSchema)
