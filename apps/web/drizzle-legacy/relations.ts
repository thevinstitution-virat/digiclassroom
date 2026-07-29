import { relations } from "drizzle-orm/relations";
import { user, account, organization, adminActivityLog, aiTutorUsage, answerFeedback, classes, communityPhrases, dictionaryWords, dictionaryOfflineSync, dictionarySearchHistory, dictionaryUserStats, enhancedUserProfiles, freeTrials, googleDriveConfig, googleDriveFolders, institutionProfiles, invitation, materials, materialApprovalLog, member, userNotes, noteActivityLog, noteFolders, noteShares, noteTemplates, notifications, practestQuestionBank, practestTestConfigurations, practestTestSessions, qdrantVectorIds, quotaAlerts, sarvagyaCreditTransactions, sarvagyaDocuments, sarvagyaSpaces, sarvagyaQueries, session, subscriptionHistory, userSubscriptions, subscriptionPlans, teacherActivityLogs, teacherClassAssignments, teacherVerificationDocuments, userMaterialAccess, userVocabProgress } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	invitations: many(invitation),
	members: many(member),
	sessions: many(session),
	teacherActivityLogs: many(teacherActivityLogs),
	teacherClassAssignments: many(teacherClassAssignments),
	teacherVerificationDocuments: many(teacherVerificationDocuments),
}));

export const adminActivityLogRelations = relations(adminActivityLog, ({one}) => ({
	organization: one(organization, {
		fields: [adminActivityLog.organizationId],
		references: [organization.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	adminActivityLogs: many(adminActivityLog),
	aiTutorUsages: many(aiTutorUsage),
	answerFeedbacks: many(answerFeedback),
	classes: many(classes),
	communityPhrases: many(communityPhrases),
	dictionaryOfflineSyncs: many(dictionaryOfflineSync),
	dictionarySearchHistories: many(dictionarySearchHistory),
	dictionaryUserStats: many(dictionaryUserStats),
	dictionaryWords: many(dictionaryWords),
	enhancedUserProfiles: many(enhancedUserProfiles),
	freeTrials: many(freeTrials),
	googleDriveConfigs: many(googleDriveConfig),
	googleDriveFolders: many(googleDriveFolders),
	institutionProfiles: many(institutionProfiles),
	invitations: many(invitation),
	materialApprovalLogs: many(materialApprovalLog),
	materials: many(materials),
	members: many(member),
	noteActivityLogs: many(noteActivityLog),
	noteFolders: many(noteFolders),
	noteShares: many(noteShares),
	noteTemplates: many(noteTemplates),
	notifications: many(notifications),
	practestQuestionBanks: many(practestQuestionBank),
	practestTestConfigurations: many(practestTestConfigurations),
	practestTestSessions: many(practestTestSessions),
	quotaAlerts: many(quotaAlerts),
	sarvagyaCreditTransactions: many(sarvagyaCreditTransactions),
	sarvagyaDocuments: many(sarvagyaDocuments),
	sarvagyaQueries: many(sarvagyaQueries),
	sarvagyaSpaces: many(sarvagyaSpaces),
	subscriptionHistories: many(subscriptionHistory),
	subscriptionPlans: many(subscriptionPlans),
	userMaterialAccesses: many(userMaterialAccess),
	userNotes: many(userNotes),
	userSubscriptions: many(userSubscriptions),
	userVocabProgresses: many(userVocabProgress),
}));

export const aiTutorUsageRelations = relations(aiTutorUsage, ({one}) => ({
	organization: one(organization, {
		fields: [aiTutorUsage.organizationId],
		references: [organization.id]
	}),
}));

export const answerFeedbackRelations = relations(answerFeedback, ({one}) => ({
	organization: one(organization, {
		fields: [answerFeedback.organizationId],
		references: [organization.id]
	}),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
	organization: one(organization, {
		fields: [classes.organizationId],
		references: [organization.id]
	}),
	teacherClassAssignments: many(teacherClassAssignments),
}));

export const communityPhrasesRelations = relations(communityPhrases, ({one}) => ({
	organization: one(organization, {
		fields: [communityPhrases.organizationId],
		references: [organization.id]
	}),
	dictionaryWord: one(dictionaryWords, {
		fields: [communityPhrases.wordId],
		references: [dictionaryWords.id]
	}),
}));

export const dictionaryWordsRelations = relations(dictionaryWords, ({one, many}) => ({
	communityPhrases: many(communityPhrases),
	dictionarySearchHistories: many(dictionarySearchHistory),
	organization: one(organization, {
		fields: [dictionaryWords.organizationId],
		references: [organization.id]
	}),
	userVocabProgresses: many(userVocabProgress),
}));

export const dictionaryOfflineSyncRelations = relations(dictionaryOfflineSync, ({one}) => ({
	organization: one(organization, {
		fields: [dictionaryOfflineSync.organizationId],
		references: [organization.id]
	}),
}));

export const dictionarySearchHistoryRelations = relations(dictionarySearchHistory, ({one}) => ({
	organization: one(organization, {
		fields: [dictionarySearchHistory.organizationId],
		references: [organization.id]
	}),
	dictionaryWord: one(dictionaryWords, {
		fields: [dictionarySearchHistory.selectedWordId],
		references: [dictionaryWords.id]
	}),
}));

export const dictionaryUserStatsRelations = relations(dictionaryUserStats, ({one}) => ({
	organization: one(organization, {
		fields: [dictionaryUserStats.organizationId],
		references: [organization.id]
	}),
}));

export const enhancedUserProfilesRelations = relations(enhancedUserProfiles, ({one}) => ({
	organization: one(organization, {
		fields: [enhancedUserProfiles.organizationId],
		references: [organization.id]
	}),
}));

export const freeTrialsRelations = relations(freeTrials, ({one}) => ({
	organization: one(organization, {
		fields: [freeTrials.organizationId],
		references: [organization.id]
	}),
}));

export const googleDriveConfigRelations = relations(googleDriveConfig, ({one}) => ({
	organization: one(organization, {
		fields: [googleDriveConfig.organizationId],
		references: [organization.id]
	}),
}));

export const googleDriveFoldersRelations = relations(googleDriveFolders, ({one}) => ({
	organization: one(organization, {
		fields: [googleDriveFolders.organizationId],
		references: [organization.id]
	}),
}));

export const institutionProfilesRelations = relations(institutionProfiles, ({one}) => ({
	organization: one(organization, {
		fields: [institutionProfiles.organizationId],
		references: [organization.id]
	}),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
}));

export const materialApprovalLogRelations = relations(materialApprovalLog, ({one}) => ({
	material: one(materials, {
		fields: [materialApprovalLog.materialId],
		references: [materials.id]
	}),
	organization: one(organization, {
		fields: [materialApprovalLog.organizationId],
		references: [organization.id]
	}),
}));

export const materialsRelations = relations(materials, ({one, many}) => ({
	materialApprovalLogs: many(materialApprovalLog),
	organization: one(organization, {
		fields: [materials.organizationId],
		references: [organization.id]
	}),
	qdrantVectorIds: many(qdrantVectorIds),
	userMaterialAccesses: many(userMaterialAccess),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const noteActivityLogRelations = relations(noteActivityLog, ({one}) => ({
	userNote: one(userNotes, {
		fields: [noteActivityLog.noteId],
		references: [userNotes.id]
	}),
	organization: one(organization, {
		fields: [noteActivityLog.organizationId],
		references: [organization.id]
	}),
}));

export const userNotesRelations = relations(userNotes, ({one, many}) => ({
	noteActivityLogs: many(noteActivityLog),
	noteShares: many(noteShares),
	organization: one(organization, {
		fields: [userNotes.organizationId],
		references: [organization.id]
	}),
}));

export const noteFoldersRelations = relations(noteFolders, ({one}) => ({
	organization: one(organization, {
		fields: [noteFolders.organizationId],
		references: [organization.id]
	}),
}));

export const noteSharesRelations = relations(noteShares, ({one}) => ({
	userNote: one(userNotes, {
		fields: [noteShares.noteId],
		references: [userNotes.id]
	}),
	organization: one(organization, {
		fields: [noteShares.organizationId],
		references: [organization.id]
	}),
}));

export const noteTemplatesRelations = relations(noteTemplates, ({one}) => ({
	organization: one(organization, {
		fields: [noteTemplates.organizationId],
		references: [organization.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	organization: one(organization, {
		fields: [notifications.organizationId],
		references: [organization.id]
	}),
}));

export const practestQuestionBankRelations = relations(practestQuestionBank, ({one}) => ({
	organization: one(organization, {
		fields: [practestQuestionBank.organizationId],
		references: [organization.id]
	}),
}));

export const practestTestConfigurationsRelations = relations(practestTestConfigurations, ({one, many}) => ({
	organization: one(organization, {
		fields: [practestTestConfigurations.organizationId],
		references: [organization.id]
	}),
	practestTestSessions: many(practestTestSessions),
}));

export const practestTestSessionsRelations = relations(practestTestSessions, ({one}) => ({
	practestTestConfiguration: one(practestTestConfigurations, {
		fields: [practestTestSessions.configurationId],
		references: [practestTestConfigurations.id]
	}),
	organization: one(organization, {
		fields: [practestTestSessions.organizationId],
		references: [organization.id]
	}),
}));

export const qdrantVectorIdsRelations = relations(qdrantVectorIds, ({one}) => ({
	material: one(materials, {
		fields: [qdrantVectorIds.materialId],
		references: [materials.id]
	}),
}));

export const quotaAlertsRelations = relations(quotaAlerts, ({one}) => ({
	organization: one(organization, {
		fields: [quotaAlerts.organizationId],
		references: [organization.id]
	}),
}));

export const sarvagyaCreditTransactionsRelations = relations(sarvagyaCreditTransactions, ({one}) => ({
	organization: one(organization, {
		fields: [sarvagyaCreditTransactions.organizationId],
		references: [organization.id]
	}),
}));

export const sarvagyaDocumentsRelations = relations(sarvagyaDocuments, ({one}) => ({
	organization: one(organization, {
		fields: [sarvagyaDocuments.organizationId],
		references: [organization.id]
	}),
	sarvagyaSpace: one(sarvagyaSpaces, {
		fields: [sarvagyaDocuments.spaceId],
		references: [sarvagyaSpaces.id]
	}),
}));

export const sarvagyaSpacesRelations = relations(sarvagyaSpaces, ({one, many}) => ({
	sarvagyaDocuments: many(sarvagyaDocuments),
	sarvagyaQueries: many(sarvagyaQueries),
	organization: one(organization, {
		fields: [sarvagyaSpaces.organizationId],
		references: [organization.id]
	}),
}));

export const sarvagyaQueriesRelations = relations(sarvagyaQueries, ({one}) => ({
	organization: one(organization, {
		fields: [sarvagyaQueries.organizationId],
		references: [organization.id]
	}),
	sarvagyaSpace: one(sarvagyaSpaces, {
		fields: [sarvagyaQueries.spaceId],
		references: [sarvagyaSpaces.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({one}) => ({
	organization: one(organization, {
		fields: [subscriptionHistory.organizationId],
		references: [organization.id]
	}),
	userSubscription: one(userSubscriptions, {
		fields: [subscriptionHistory.subscriptionId],
		references: [userSubscriptions.id]
	}),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one, many}) => ({
	subscriptionHistories: many(subscriptionHistory),
	organization: one(organization, {
		fields: [userSubscriptions.organizationId],
		references: [organization.id]
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [userSubscriptions.subscriptionPlanId],
		references: [subscriptionPlans.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({one, many}) => ({
	organization: one(organization, {
		fields: [subscriptionPlans.organizationId],
		references: [organization.id]
	}),
	userSubscriptions: many(userSubscriptions),
}));

export const teacherActivityLogsRelations = relations(teacherActivityLogs, ({one}) => ({
	user: one(user, {
		fields: [teacherActivityLogs.teacherId],
		references: [user.id]
	}),
}));

export const teacherClassAssignmentsRelations = relations(teacherClassAssignments, ({one}) => ({
	class: one(classes, {
		fields: [teacherClassAssignments.classId],
		references: [classes.id]
	}),
	user: one(user, {
		fields: [teacherClassAssignments.teacherId],
		references: [user.id]
	}),
}));

export const teacherVerificationDocumentsRelations = relations(teacherVerificationDocuments, ({one}) => ({
	user: one(user, {
		fields: [teacherVerificationDocuments.teacherId],
		references: [user.id]
	}),
}));

export const userMaterialAccessRelations = relations(userMaterialAccess, ({one}) => ({
	material: one(materials, {
		fields: [userMaterialAccess.materialId],
		references: [materials.id]
	}),
	organization: one(organization, {
		fields: [userMaterialAccess.organizationId],
		references: [organization.id]
	}),
}));

export const userVocabProgressRelations = relations(userVocabProgress, ({one}) => ({
	organization: one(organization, {
		fields: [userVocabProgress.organizationId],
		references: [organization.id]
	}),
	dictionaryWord: one(dictionaryWords, {
		fields: [userVocabProgress.wordId],
		references: [dictionaryWords.id]
	}),
}));