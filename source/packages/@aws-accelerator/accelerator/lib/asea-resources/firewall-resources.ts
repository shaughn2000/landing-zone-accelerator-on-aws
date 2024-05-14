/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { AseaResourceType, CfnResourceType } from '@aws-accelerator/config/lib/common/types';
import { ImportAseaResourcesStack, LogLevel } from '../stacks/import-asea-resources-stack';
import { AseaResource, AseaResourceProps } from './resource';
import { AseaStackInfo } from '@aws-accelerator/config';
import * as cdk from 'aws-cdk-lib';
import { pascalCase } from 'pascal-case';
import { SsmResourceType } from '@aws-accelerator/utils';

const EC2_FIREWALL_INSTANCE_TYPE = 'AWS::EC2::Instance';
const ASEA_PHASE_NUMBER_FIREWALL_INSTANCE = 2;

type NestedAseaStackInfo = AseaStackInfo & { logicalResourceId: string };

export interface FirewallResourcesProps extends AseaResourceProps {
  /**
   * Nested Stacks of current phase stack
   */
  nestedStacksInfo: NestedAseaStackInfo[];
}

/**
 * Handles EC2 Firewall Instances created by ASEA.
 * All EC2 Firewall Instances are deployed in Phase-2
 */
export class FirewallResources extends AseaResource {
  constructor(scope: ImportAseaResourcesStack, props: FirewallResourcesProps) {
    super(scope, props);
    const existingFirewallInstances = this.filterResourcesByType(props.stackInfo.resources, EC2_FIREWALL_INSTANCE_TYPE);
    this.processFirewallInstances(props, existingFirewallInstances);
  }

  private processFirewallInstances(props: FirewallResourcesProps, existingFirewallInstances: CfnResourceType[]) {
    if (props.stackInfo.phase !== ASEA_PHASE_NUMBER_FIREWALL_INSTANCE) {
      this.scope.addLogs(
        LogLevel.INFO,
        `No ${EC2_FIREWALL_INSTANCE_TYPE}s to handle in stack ${props.stackInfo.stackName}`,
      );
      return;
    }
    const firewallConfigInstances = props.customizationsConfig.firewalls?.instances;

    for (const existingFirewallInstance of existingFirewallInstances) {
      const firewallInstanceName = this.getAseaFirewallInstanceNameFromTags(existingFirewallInstance);
      //ASEA appends _az to each Firewall instance and creates one per az
      const firewallInstanceNameWithoutAz = firewallInstanceName.split('_az')[0];
      const firewallInstanceConfig = firewallConfigInstances?.find(
        firewallConfigInstance => firewallConfigInstance.name === firewallInstanceNameWithoutAz,
      );

      const firewallInstance = this.stack.getResource(
        existingFirewallInstance.logicalResourceId,
      ) as unknown as cdk.aws_ec2.CfnInstance;

      //Leaving as temporary placeholder for deletion handler
      firewallInstanceConfig;
      firewallInstance;

      this.scope.addSsmParameter({
        logicalId: pascalCase(`SsmParam${pascalCase(firewallInstanceName)}`),
        parameterName: this.scope.getSsmPath(SsmResourceType.FIREWALL_INSTANCE, [firewallInstanceName]),
        stringValue: existingFirewallInstance.physicalResourceId,
      });
      this.scope.addAseaResource(AseaResourceType.FIREWALL_INSTANCE, firewallInstanceName);
    }
  }

  private getAseaFirewallInstanceNameFromTags(existingFirewallInstance: CfnResourceType, tagName = 'Name') {
    const nameTag = existingFirewallInstance.resourceMetadata['Properties'].Tags.find(
      (tag: { Key: string; Value: string }) => tag.Key === tagName,
    );
    const firewallName = nameTag.Value;
    return firewallName;
  }
}
