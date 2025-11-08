import { useEffect } from 'react';
import { revenueAPI, notificationsAPI } from '../../services/api';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';

const AlertSystem = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedStore && user) {
      checkAlerts();
    }
  }, [selectedStore, user]);

  const checkAlerts = async () => {
    if (!selectedStore || !user) return;

    try {
      // Check for missing daily entries (last 7 days)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const revenueRes = await revenueAPI.getRevenueRange(selectedStore.id, startDate, endDate);
      const existingDates = new Set((revenueRes.data?.revenues || []).map(r => r.entry_date));
      
      // Check each day in the last 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Skip today if it's still early in the day (before 6 PM)
        if (i === 0 && today.getHours() < 18) {
          continue;
        }
        
        if (!existingDates.has(dateStr)) {
          // Check if notification already exists for this missing entry
          try {
            const existingNotifications = await notificationsAPI.getAll({
              store_id: selectedStore.id,
              notification_type: 'missing_entry',
              limit: 50
            });
            
            const notificationExists = existingNotifications.data?.notifications?.some(
              n => n.metadata?.date === dateStr && !n.is_read
            );
            
            if (!notificationExists) {
              await notificationsAPI.create({
                store_id: selectedStore.id,
                notification_type: 'missing_entry',
                title: 'Missing Daily Entry',
                message: `No revenue entry found for ${new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
                priority: 'normal',
                action_url: `/revenue?storeId=${selectedStore.id}&date=${dateStr}`,
                metadata: { date: dateStr }
              });
            }
          } catch (error) {
            console.error('Error creating missing entry notification:', error);
          }
        }
      }

      // Check for low lottery cash on hand (removed business cash check)
      try {
        const latestRevenueRes = await revenueAPI.getDailyRevenue(selectedStore.id, today.toISOString().split('T')[0]);
        if (latestRevenueRes.data?.cashOnHand) {
          const lotteryCash = latestRevenueRes.data.cashOnHand.lotteryCashOnHand || 0;
          
          // Alert if lottery cash is below $200
          if (lotteryCash < 200) {
            // Check if notification already exists
            try {
              const existingNotifications = await notificationsAPI.getAll({
                store_id: selectedStore.id,
                notification_type: 'low_lottery_cash',
                limit: 10
              });
              
              const notificationExists = existingNotifications.data?.notifications?.some(
                n => n.notification_type === 'low_lottery_cash' && !n.is_read
              );
              
              if (!notificationExists) {
                await notificationsAPI.create({
                  store_id: selectedStore.id,
                  notification_type: 'low_lottery_cash',
                  title: 'Low Lottery Cash',
                  message: `Lottery cash on hand is $${lotteryCash.toFixed(2)}.`,
                  priority: 'warning',
                  metadata: { amount: lotteryCash }
                });
              }
            } catch (error) {
              console.error('Error creating low lottery cash notification:', error);
            }
          }
        }
      } catch (error) {
        // If no entry for today, that's already handled above
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  };

  // This component doesn't render anything - it just creates notifications
  return null;
};

export default AlertSystem;

