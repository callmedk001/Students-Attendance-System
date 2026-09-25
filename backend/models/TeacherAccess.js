import mongoose from 'mongoose'

const teacherAccessSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  },
  { timestamps: true, collection: 'teachingassignments' },
)

teacherAccessSchema.index({ teacherId: 1, classId: 1, subjectId: 1 }, { unique: true })

export default mongoose.model('TeacherAccess', teacherAccessSchema)
