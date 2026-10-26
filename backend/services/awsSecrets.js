import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

const REGION = process.env.AWS_REGION || 'us-east-1';
const PARAMETER_PATH = '/sahaya/prod/';

/**
 * Loads sensitive credentials from AWS Systems Manager Parameter Store
 * into process.env at runtime without hardcoding.
 */
export async function loadAwsSecrets() {
  // If running in development without AWS credentials configured, gracefully continue
  try {
    const ssm = new SSMClient({ region: REGION });
    const command = new GetParametersByPathCommand({
      Path: PARAMETER_PATH,
      WithDecryption: true,
      Recursive: true,
    });

    const response = await ssm.send(command);
    if (response.Parameters && response.Parameters.length > 0) {
      console.log(`[AWS SSM] Successfully fetched ${response.Parameters.length} parameters from ${PARAMETER_PATH}`);
      for (const param of response.Parameters) {
        // e.g. /sahaya/prod/DB_HOST -> DB_HOST
        const key = param.Name.replace(PARAMETER_PATH, '');
        if (!process.env[key] || process.env[key] === '') {
          process.env[key] = param.Value;
        }
      }
      return true;
    } else {
      console.log(`[AWS SSM] No parameters found under path ${PARAMETER_PATH}. Using environment variables.`);
      return false;
    }
  } catch (err) {
    console.warn(`[AWS SSM] Could not load parameters from SSM (${err.message}). Using local environment fallback.`);
    return false;
  }
}
