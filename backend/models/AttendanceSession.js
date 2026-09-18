import mongoose from 'mongoose'

const attendanceSessionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    periodNumber: {
      type: Number,
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      required: true,
    },
  },
  { timestamps: true },
)

attendanceSessionSchema.index(
  { date: 1, classId: 1, subjectId: 1, periodNumber: 1 },
  { unique: true },
)

export default mongoose.model('AttendanceSession', attendanceSessionSchema)
