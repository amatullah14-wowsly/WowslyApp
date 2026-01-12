import React from 'react';
import { useRoute } from '@react-navigation/native';
import GuestScreenTemplate from './GuestScreenTemplate';

const GuestList = () => {
  const route = useRoute<any>();
  const { eventId } = route.params || {};

  return <GuestScreenTemplate initialFilter="Registered" eventId={eventId} />;
};

export default GuestList;