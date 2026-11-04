import mongoose from 'mongoose'

const attendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'OD'],
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: 'updatedAt' },
  },
)

attendanceRecordSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true },
)
attendanceRecordSchema.index({ studentId: 1, sessionId: 1 })
attendanceRecordSchema.index({ studentId: 1, markedAt: -1 })

export default mongoose.model('AttendanceRecord', attendanceRecordSchema)
