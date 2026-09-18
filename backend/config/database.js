import mongoose from 'mongoose'

function connectionErrorMessage(error) {
  const errorCode = error?.code
  const errorName = error?.name || ''
  const errorMessage = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  if (errorCode === 8000 || errorMessage.includes('bad auth') || errorMessage.includes('authentication failed')) {
    return 'MongoDB authentication failed. Check the Atlas database username and password in backend/.env.'
  }

  if (errorMessage.includes('whitelisted') || errorMessage.includes('ip address is not allowed')) {
    return 'MongoDB Atlas rejected this machine IP address. In Atlas, open Network Access, add your current IP address, and restart the backend.'
  }

  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(errorCode)
    || errorName === 'MongoNetworkError'
    || errorMessage.includes('querysrv')) {
    return 'MongoDB network connection failed. Check Atlas Network Access and allow this machine IP address.'
  }

  if (errorName === 'MongoParseError' || errorMessage.includes('invalid scheme') || errorMessage.includes('connection string')) {
    return 'MongoDB URI is invalid. Check that MONGODB_URI is a valid mongodb:// or mongodb+srv:// URI.'
  }

  return 'MongoDB connection failed. Check the Atlas URI, credentials, and network access settings.'
}

function developmentErrorDetails(error) {
  const message = String(error?.message || '')
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]')
    .replace(/(private[_-]?key|password|token)\s*[:=]\s*\S+/gi, '$1=[redacted]')
  return `type=${error?.name || 'UnknownError'} code=${error?.code ?? 'none'} message=${message || 'No error message'}`
}

export async function connectDatabase() {
  const connectionString = process.env.MONGODB_URI?.trim()

  if (!connectionString) {
    throw new Error('MONGODB_URI is missing. Add the MongoDB Atlas connection string to backend/.env.')
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(connectionString)) {
    throw new Error('MongoDB URI is invalid. MONGODB_URI must begin with mongodb:// or mongodb+srv://.')
  }

  try {
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log('MongoDB connected successfully')
  } catch (error) {
    const safeMessage = connectionErrorMessage(error)
    if (process.env.NODE_ENV !== 'production') {
      console.error(`MongoDB diagnostic: ${developmentErrorDetails(error)}`)
    }
    console.error(safeMessage)
    throw new Error(safeMessage)
  }
}
