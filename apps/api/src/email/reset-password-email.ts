interface SendPasswordResetEmailArgs {
  to: string;
  subject: string;
  text: string;
}

export const sendResetPasswordEmail = async ({
  to,
  subject,
  text,
}: SendPasswordResetEmailArgs) => {
  console.log('\n' + '='.repeat(60));
  console.log('📧 MOCK EMAIL SENT');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(60));
  console.log(text);
  console.log('='.repeat(60) + '\n');
};
