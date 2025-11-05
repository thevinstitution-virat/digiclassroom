/**
 * Mitram Notifications API
 * Handles alerts and communications for assessment results
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock notification service (replace with actual Twilio/WhatsApp integration)
const notificationService = {
  sendWhatsApp: async (to: string, message: string) => {
    console.log(`WhatsApp to ${to}: ${message}`)
    return { success: true, messageId: `wa_${Date.now()}` }
  },
  
  sendSMS: async (to: string, message: string) => {
    console.log(`SMS to ${to}: ${message}`)
    return { success: true, messageId: `sms_${Date.now()}` }
  },
  
  sendEmail: async (to: string, subject: string, body: string) => {
    console.log(`Email to ${to}: ${subject}`)
    return { success: true, messageId: `email_${Date.now()}` }
  }
}

// Mock database for notifications
const mockNotificationDB = {
  notifications: new Map(),
  
  saveNotification: (notificationData: any) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const notification = {
      id,
      ...notificationData,
      createdAt: new Date().toISOString()
    }
    mockNotificationDB.notifications.set(id, notification)
    return notification
  },
  
  getUserNotifications: (userId: string) => {
    return Array.from(mockNotificationDB.notifications.values())
      .filter((notif: any) => notif.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },
  
  markAsRead: (notificationId: string) => {
    const notification = mockNotificationDB.notifications.get(notificationId)
    if (notification) {
      notification.readAt = new Date().toISOString()
      mockNotificationDB.notifications.set(notificationId, notification)
    }
    return notification
  }
}

// POST /api/mitram/notify - Send notifications based on assessment results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      userId, 
      parentId, 
      teacherId, 
      module, 
      alertType, 
      scores, 
      gradeLevel, 
      studentName,
      parentPhone,
      parentEmail,
      teacherEmail 
    } = body

    // Validate required fields
    if (!userId || !module || !alertType || !scores) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Generate appropriate messages based on alert type and module
    const messages = generateNotificationMessages(
      alertType, 
      module, 
      scores, 
      gradeLevel, 
      studentName
    )

    const notifications = []
    const sentMessages = []

    // Send notifications to different recipients
    if (parentPhone && (alertType === 'low_score' || alertType === 'intervention_needed')) {
      try {
        const whatsappResult = await notificationService.sendWhatsApp(
          parentPhone, 
          messages.parent.whatsapp
        )
        sentMessages.push({ type: 'whatsapp', recipient: 'parent', ...whatsappResult })
      } catch (error) {
        console.error('WhatsApp notification failed:', error)
      }
    }

    if (parentEmail) {
      try {
        const emailResult = await notificationService.sendEmail(
          parentEmail,
          messages.parent.email.subject,
          messages.parent.email.body
        )
        sentMessages.push({ type: 'email', recipient: 'parent', ...emailResult })
      } catch (error) {
        console.error('Parent email notification failed:', error)
      }
    }

    if (teacherEmail && alertType === 'intervention_needed') {
      try {
        const teacherEmailResult = await notificationService.sendEmail(
          teacherEmail,
          messages.teacher.email.subject,
          messages.teacher.email.body
        )
        sentMessages.push({ type: 'email', recipient: 'teacher', ...teacherEmailResult })
      } catch (error) {
        console.error('Teacher email notification failed:', error)
      }
    }

    // Save notification record
    const notification = mockNotificationDB.saveNotification({
      userId,
      parentId,
      teacherId,
      module,
      alertType,
      message: messages.student.dashboard,
      severity: determineSeverity(alertType, scores),
      sentVia: sentMessages,
      scores
    })

    notifications.push(notification)

    // Generate follow-up recommendations
    const followUpActions = generateFollowUpActions(alertType, module, scores, gradeLevel)

    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      messagesSent: sentMessages.length,
      sentTo: sentMessages.map(msg => `${msg.type} to ${msg.recipient}`),
      followUpActions,
      nextSteps: generateNextSteps(alertType, module)
    })

  } catch (error) {
    console.error('Error sending notifications:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send notifications'
    }, { status: 500 })
  }
}

// GET /api/mitram/notify - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId parameter'
      }, { status: 400 })
    }

    let notifications = mockNotificationDB.getUserNotifications(userId)

    if (unreadOnly) {
      notifications = notifications.filter((notif: any) => !notif.readAt)
    }

    return NextResponse.json({
      success: true,
      notifications: notifications.map(notif => ({
        id: notif.id,
        module: notif.module,
        alertType: notif.alertType,
        message: notif.message,
        severity: notif.severity,
        createdAt: notif.createdAt,
        readAt: notif.readAt,
        isRead: !!notif.readAt
      })),
      unreadCount: notifications.filter((notif: any) => !notif.readAt).length
    })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications'
    }, { status: 500 })
  }
}

// PUT /api/mitram/notify - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing notificationId'
      }, { status: 400 })
    }

    const notification = mockNotificationDB.markAsRead(notificationId)

    if (!notification) {
      return NextResponse.json({
        success: false,
        error: 'Notification not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        readAt: notification.readAt
      }
    })

  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update notification'
    }, { status: 500 })
  }
}

/**
 * Generate notification messages for different recipients and channels
 */
function generateNotificationMessages(
  alertType: string, 
  module: string, 
  scores: any, 
  gradeLevel: number, 
  studentName: string = 'Your child'
) {
  const moduleDisplayName = getModuleDisplayName(module)
  const score = scores.overall || 0

  const messages = {
    student: {
      dashboard: ''
    },
    parent: {
      whatsapp: '',
      email: {
        subject: '',
        body: ''
      }
    },
    teacher: {
      email: {
        subject: '',
        body: ''
      }
    }
  }

  switch (alertType) {
    case 'low_score':
      messages.student.dashboard = `Your ${moduleDisplayName} assessment score (${score}) is below grade level expectations. Don't worry - we have personalized strategies to help you improve!`
      
      messages.parent.whatsapp = `🎓 VG Kosh Alert: ${studentName}'s ${moduleDisplayName} assessment score (${score}/100) needs attention. We've prepared personalized improvement strategies. Check the Mitram dashboard for details. 📱`
      
      messages.parent.email.subject = `${studentName}'s ${moduleDisplayName} Assessment - Support Needed`
      messages.parent.email.body = `Dear Parent,\n\n${studentName} recently completed the ${moduleDisplayName} assessment and scored ${score}/100, which is below the expected range for Grade ${gradeLevel}.\n\nThis is not uncommon and with the right support, significant improvement is possible. We've prepared:\n\n• Personalized intervention strategies\n• Home practice activities\n• Progress tracking tools\n\nPlease log into the VG Kosh Mitram dashboard to review the detailed recommendations.\n\nBest regards,\nVG Kosh Team`
      
      messages.teacher.email.subject = `Student Support Alert - ${studentName} (${moduleDisplayName})`
      messages.teacher.email.body = `Dear Teacher,\n\n${studentName} in Grade ${gradeLevel} has scored ${score}/100 in the ${moduleDisplayName} assessment, indicating a need for additional support.\n\nRecommended classroom strategies:\n• Provide additional scaffolding\n• Consider peer mentoring\n• Monitor progress closely\n\nDetailed recommendations are available in the teacher dashboard.\n\nBest regards,\nVG Kosh Team`
      break

    case 'improvement':
      messages.student.dashboard = `Excellent progress! Your ${moduleDisplayName} score improved to ${score}. Keep up the great work!`
      
      messages.parent.whatsapp = `🎉 Great news! ${studentName}'s ${moduleDisplayName} score improved to ${score}/100. Their hard work is paying off! 👏`
      
      messages.parent.email.subject = `Wonderful Progress - ${studentName}'s ${moduleDisplayName} Improvement`
      messages.parent.email.body = `Dear Parent,\n\nWe're excited to share that ${studentName} has shown significant improvement in ${moduleDisplayName}, scoring ${score}/100 in their latest assessment.\n\nThis progress reflects their dedication and your support. Continue encouraging their efforts!\n\nBest regards,\nVG Kosh Team`
      break

    case 'intervention_needed':
      messages.student.dashboard = `We've noticed some challenges in your ${moduleDisplayName} assessment. Let's work together with your parents and teachers to create a support plan.`
      
      messages.parent.whatsapp = `🚨 Important: ${studentName} needs additional support in ${moduleDisplayName} (Score: ${score}). Please check Mitram for intervention strategies. Let's work together! 💪`
      
      messages.parent.email.subject = `Urgent: ${studentName} Needs Additional Support - ${moduleDisplayName}`
      messages.parent.email.body = `Dear Parent,\n\n${studentName}'s ${moduleDisplayName} assessment results indicate a need for immediate intervention (Score: ${score}/100).\n\nWe recommend:\n• Scheduling a parent-teacher meeting\n• Implementing daily support strategies\n• Regular progress monitoring\n\nPlease contact us to discuss a comprehensive support plan.\n\nBest regards,\nVG Kosh Team`
      break

    case 'milestone':
      messages.student.dashboard = `🎯 Milestone achieved! You've reached an important goal in ${moduleDisplayName}. Celebrate this success!`
      
      messages.parent.whatsapp = `🏆 Milestone Alert! ${studentName} achieved an important goal in ${moduleDisplayName} (Score: ${score}). Time to celebrate! 🎉`
      
      messages.parent.email.subject = `Milestone Achievement - ${studentName} (${moduleDisplayName})`
      messages.parent.email.body = `Dear Parent,\n\n${studentName} has reached an important milestone in ${moduleDisplayName} with a score of ${score}/100.\n\nThis achievement demonstrates their growth and commitment to learning. Please take a moment to celebrate this success with them!\n\nBest regards,\nVG Kosh Team`
      break
  }

  return messages
}

/**
 * Get display name for modules
 */
function getModuleDisplayName(module: string): string {
  const displayNames = {
    attention: 'Focus & Attention',
    grit: 'Perseverance & Grit',
    decision: 'Decision Making',
    habit: 'Habit Management',
    aptitude: 'Cognitive Aptitude'
  }
  return displayNames[module as keyof typeof displayNames] || module
}

/**
 * Determine notification severity
 */
function determineSeverity(alertType: string, scores: any): string {
  const score = scores.overall || 0
  
  switch (alertType) {
    case 'low_score':
      return score < 30 ? 'critical' : score < 50 ? 'high' : 'medium'
    case 'intervention_needed':
      return 'high'
    case 'improvement':
      return 'low'
    case 'milestone':
      return 'low'
    default:
      return 'medium'
  }
}

/**
 * Generate follow-up actions based on alert type
 */
function generateFollowUpActions(alertType: string, module: string, scores: any, gradeLevel: number): string[] {
  const actions = []
  
  switch (alertType) {
    case 'low_score':
    case 'intervention_needed':
      actions.push('Schedule parent-teacher meeting within 1 week')
      actions.push('Implement daily practice routine')
      actions.push('Monitor progress weekly')
      actions.push('Provide additional learning resources')
      break
      
    case 'improvement':
      actions.push('Continue current strategies')
      actions.push('Set next milestone goal')
      actions.push('Share success with family')
      break
      
    case 'milestone':
      actions.push('Celebrate achievement')
      actions.push('Set new challenging goals')
      actions.push('Share success story')
      break
  }
  
  return actions
}

/**
 * Generate next steps based on alert type and module
 */
function generateNextSteps(alertType: string, module: string): string[] {
  return [
    'Review detailed assessment results',
    'Implement recommended strategies',
    'Track daily progress',
    'Schedule follow-up assessment in 2-4 weeks'
  ]
}
