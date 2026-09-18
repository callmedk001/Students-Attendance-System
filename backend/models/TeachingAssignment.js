import mongoose from 'mongoose'

const teachingAssignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
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
  },
  { timestamps: true },
)

teachingAssignmentSchema.index({ teacherId: 1, classId: 1, subjectId: 1 }, { unique: true })

export default mongoose.model('TeachingAssignment', teachingAssignmentSchema)
