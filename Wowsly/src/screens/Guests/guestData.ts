export type GuestGroup = 'Manager' | 'Invited' | 'Registered';

export type GuestStatus = 'Checked In' | 'Pending' | 'No-Show';

export type Guest = {
  id: string;
  name: string;
  group: GuestGroup;
  status: GuestStatus;
  avatar: string;
};

export const guestListData: Guest[] = [
  {
    id: '1',
    name: 'Alicia Keys',
    group: 'Manager',
    status: 'Checked In',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
  },
  {
    id: '3',
    name: 'Blake Shelton',
    group: 'Registered',
    status: 'Checked In',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
  },
  {
    id: '4',
    name: 'Bruce Springsteen',
    group: 'Manager',
    status: 'Checked In',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  },
  {
    id: '6',
    name: 'Dua Lipa',
    group: 'Registered',
    status: 'Checked In',
    avatar: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=200',
  },
  {
    id: '8',
    name: 'Fergie',
    group: 'Manager',
    status: 'Checked In',
    avatar: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=200',
  },
];

