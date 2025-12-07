import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';

import {
  AppContainer,
  AppInput,
  AppText,
  BackHeader,
} from '../../components';
import { useAppSelector } from '../../redux';
import { hp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';

const DEFAULT_VALUE = 'None';

export default function ViewProfileScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAppSelector(state => state.userState);

  const PROFILE_ITEMS = {
    firstName: t('profile.firstName'),
    lastName: t('profile.lastName'),
    email: t('profile.email'),
    doa: t('profile.dateOfActivation'),
    dob: t('profile.dateOfBirth'),
    empId: t('profile.empId'),
    empType: t('profile.employmentType'),
    designation: t('profile.designation'),
  };

  return (
    <AppContainer>
      <BackHeader title={t('profile.profileDetails')} isTitleVisible={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <AppInput
          value={userData?.firstName || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.firstName}
          label={PROFILE_ITEMS.firstName}
        />
        <AppInput
          value={userData?.lastName || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.lastName}
          label={PROFILE_ITEMS.lastName}
        />
        <AppInput
          value={userData?.email || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.email}
          label={PROFILE_ITEMS.email}
        />
        <AppInput
          value={DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.doa}
          label={PROFILE_ITEMS.doa}
        />
        <AppInput
          value={DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.dob}
          label={PROFILE_ITEMS.dob}
        />
        <AppInput
          value={DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.empId}
          label={PROFILE_ITEMS.empId}
        />
        <AppInput
          value={DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.empType}
          label={PROFILE_ITEMS.empType}
        />
        <AppInput
          value={DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.designation}
          label={PROFILE_ITEMS.designation}
        />
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: hp(2),
    opacity: 0.7,
  },
});

